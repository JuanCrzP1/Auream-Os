import { randomUUID } from "node:crypto";
import {
  BUSINESS_DATA_LIMITS,
  businessValuesOf,
  type BusinessDataResponse,
  type BusinessDatum,
  type BusinessValuesResponse
} from "../../../contracts/BusinessDataContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { requireDatumChanges, requireNewDatum } from "../domain/BusinessDatum";
import { businessDataUsage } from "../domain/businessDataUses";
import type { BusinessDataRepository, BusinessDataTexts, BusinessValuesCache } from "./BusinessDataPorts";

// ---------------------------------------------------------------------------
// Datos del negocio: el catálogo de la cuenta con dónde se usa cada dato y un
// mensaje real que lo usa; crear, cambiar y borrar (dueños y administradores,
// lo exige la ruta); y solo los valores, para quien los pone en un texto (el
// chat, la vista previa de una difusión). Todo filtra por cuenta.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DatumInput = { readonly label?: unknown; readonly key?: unknown; readonly type?: unknown; readonly value?: unknown; readonly description?: unknown };

export class BusinessDataServices {
  public constructor(
    private readonly repository: BusinessDataRepository,
    private readonly texts: BusinessDataTexts,
    private readonly cache: BusinessValuesCache,
    private readonly newId: () => string = randomUUID
  ) {}

  public async list(tenantId: string, canManage: boolean): Promise<BusinessDataResponse> {
    const [data, flows, broadcasts, quickReplies] = await Promise.all([
      this.repository.list(tenantId),
      this.texts.flows(tenantId),
      this.texts.broadcasts(tenantId),
      this.texts.quickReplies(tenantId)
    ]);
    const usage = businessDataUsage(flows, broadcasts, quickReplies);
    return {
      data: data.map((datum) => ({ ...datum, uses: usage.uses.get(datum.key) ?? [], example: usage.examples.get(datum.key) ?? null })),
      canManage
    };
  }

  /** Solo los valores con su tipo (`{ g_horario: "…" }`). */
  public async values(tenantId: string): Promise<BusinessValuesResponse> {
    return { values: businessValuesOf(await this.repository.list(tenantId)) };
  }

  public async create(tenantId: string, input: DatumInput, actorId: string): Promise<BusinessDatum> {
    const datum = requireNewDatum(input);
    if ((await this.repository.list(tenantId)).length >= BUSINESS_DATA_LIMITS.maxData) {
      throw new ValidationError(`La cuenta admite hasta ${BUSINESS_DATA_LIMITS.maxData} datos del negocio. Borra los que no uses.`);
    }
    const created = await this.repository.create(tenantId, this.newId(), datum, actorId);
    if (!created) throw new ValidationError(`Ya hay un dato con la clave {${datum.key}}.`);
    this.cache.forget(tenantId);
    return created;
  }

  public async update(tenantId: string, id: string, input: DatumInput, actorId: string): Promise<BusinessDatum> {
    const current = await this.require(tenantId, id);
    const updated = await this.repository.update(tenantId, id, requireDatumChanges(current, input), actorId);
    if (!updated) throw new NotFoundError("Ese dato ya no existe.");
    this.cache.forget(tenantId);
    return updated;
  }

  /** Uno que se usa en algún mensaje solo se borra escribiendo su clave: esos mensajes quedarían con un hueco. */
  public async remove(tenantId: string, id: string, confirm: unknown): Promise<void> {
    const current = await this.require(tenantId, id);
    const { data } = await this.list(tenantId, true);
    const uses = data.find((datum) => datum.id === id)?.uses.length ?? 0;
    if (uses > 0 && (typeof confirm !== "string" || confirm.trim() !== current.key)) {
      throw new ValidationError(`Para borrarlo escribe «${current.key}»: ${uses === 1 ? "1 mensaje lo usa" : `${uses} mensajes lo usan`} y quedaría sin ese dato.`);
    }
    if (!(await this.repository.remove(tenantId, id))) throw new NotFoundError("Ese dato ya no existe.");
    this.cache.forget(tenantId);
  }

  private async require(tenantId: string, id: string): Promise<BusinessDatum> {
    const current = UUID.test(id) ? await this.repository.find(tenantId, id) : null;
    if (!current) throw new NotFoundError("Ese dato ya no existe.");
    return current;
  }
}
