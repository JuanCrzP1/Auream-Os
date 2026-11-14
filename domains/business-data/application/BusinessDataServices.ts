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
import { datumChanges } from "../domain/datumChanges";
import type { BusinessDataClock, BusinessDataRepository, BusinessDataTexts, BusinessValuesCache } from "./BusinessDataPorts";
import { BusinessDataTimeline, requireDatum } from "./BusinessDataTimeline";

// ---------------------------------------------------------------------------
// Datos del negocio: el catálogo de la cuenta con dónde se usa cada dato y un
// mensaje real que lo usa; crear, cambiar y borrar (dueños y administradores,
// lo exige la ruta); y solo los valores, para quien los pone en un texto (el
// chat, la vista previa de una difusión), con el valor del momento (el de un
// cambio programado mientras rige). Cada cambio deja su línea en el
// historial; los programados y el historial viven en `timeline`. Todo
// filtra por cuenta.
// ---------------------------------------------------------------------------

const DEFAULT_TIME_ZONE = "America/Bogota";

type DatumInput = { readonly label?: unknown; readonly key?: unknown; readonly type?: unknown; readonly value?: unknown; readonly description?: unknown };

export class BusinessDataServices {
  /** Cambios programados e historial. */
  public readonly timeline: BusinessDataTimeline;
  private readonly newId: () => string;
  private readonly now: () => Date;
  private readonly timeZoneOf: (tenantId: string) => Promise<string>;

  public constructor(
    private readonly repository: BusinessDataRepository,
    private readonly texts: BusinessDataTexts,
    private readonly cache: BusinessValuesCache,
    clock: BusinessDataClock = {}
  ) {
    this.newId = clock.newId ?? randomUUID;
    this.now = clock.now ?? (() => new Date());
    this.timeZoneOf = clock.timeZoneOf ?? (async () => DEFAULT_TIME_ZONE);
    this.timeline = new BusinessDataTimeline(repository, cache, { newId: this.newId, now: this.now, timeZoneOf: this.timeZoneOf });
  }

  public async list(tenantId: string, canManage: boolean): Promise<BusinessDataResponse> {
    const [data, flows, broadcasts, quickReplies, timeZone] = await Promise.all([
      this.repository.list(tenantId),
      this.texts.flows(tenantId),
      this.texts.broadcasts(tenantId),
      this.texts.quickReplies(tenantId),
      this.timeZoneOf(tenantId)
    ]);
    const usage = businessDataUsage(flows, broadcasts, quickReplies);
    return {
      data: data.map((datum) => ({ ...datum, uses: usage.uses.get(datum.key) ?? [], example: usage.examples.get(datum.key) ?? null })),
      canManage,
      timeZone
    };
  }

  /** Solo los valores con su tipo (`{ g_horario: "…" }`), los de este momento. */
  public async values(tenantId: string): Promise<BusinessValuesResponse> {
    return { values: businessValuesOf(await this.repository.list(tenantId), this.now()) };
  }

  public async create(tenantId: string, input: DatumInput, actorId: string): Promise<BusinessDatum> {
    const datum = requireNewDatum(input);
    if ((await this.repository.list(tenantId)).length >= BUSINESS_DATA_LIMITS.maxData) {
      throw new ValidationError(`La cuenta admite hasta ${BUSINESS_DATA_LIMITS.maxData} datos del negocio. Borra los que no uses.`);
    }
    const created = await this.repository.create(tenantId, this.newId(), datum, { actorId, changes: [{ kind: "created", value: datum.value }] });
    if (!created) throw new ValidationError(`Ya hay un dato con la clave {${datum.key}}.`);
    this.cache.forget(tenantId);
    return created;
  }

  /** Guardar sin cambiar nada no escribe ni deja línea. El tipo no cambia mientras haya cambios programados: su valor es del tipo de hoy. */
  public async update(tenantId: string, id: string, input: DatumInput, actorId: string): Promise<BusinessDatum> {
    const current = await requireDatum(this.repository, tenantId, id);
    const next = requireDatumChanges(current, input);
    if (next.type !== current.type && current.schedules.length > 0) {
      throw new ValidationError("Quita sus cambios programados antes de cambiarle el tipo: su valor es del tipo de ahora.");
    }
    const changes = datumChanges(current, next);
    if (changes.length === 0) return current;
    const updated = await this.repository.update(tenantId, id, next, { actorId, changes });
    if (!updated) throw new NotFoundError("Ese dato ya no existe.");
    this.cache.forget(tenantId);
    return updated;
  }

  /** Uno que se usa en algún mensaje solo se borra escribiendo su clave: esos mensajes quedarían con un hueco. */
  public async remove(tenantId: string, id: string, confirm: unknown, actorId: string): Promise<void> {
    const current = await requireDatum(this.repository, tenantId, id);
    const { data } = await this.list(tenantId, true);
    const uses = data.find((datum) => datum.id === id)?.uses.length ?? 0;
    if (uses > 0 && (typeof confirm !== "string" || confirm.trim() !== current.key)) {
      throw new ValidationError(`Para borrarlo escribe «${current.key}»: ${uses === 1 ? "1 mensaje lo usa" : `${uses} mensajes lo usan`} y quedaría sin ese dato.`);
    }
    if (!(await this.repository.remove(tenantId, id, { actorId, changes: [{ kind: "deleted", value: current.value }] }))) throw new NotFoundError("Ese dato ya no existe.");
    this.cache.forget(tenantId);
  }
}
