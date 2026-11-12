import { randomUUID } from "node:crypto";
import { SALES_LINES_PER_TENANT_MAX, type SalesLineListResponse, type SalesLineSummary, type SaveSalesLineRequest } from "../../../contracts/SalesLineContracts";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { salesLineDraft, type SalesLine } from "../domain/SalesLine";
import type { SalesLineRepository } from "./SalesLineRepository";

// ---------------------------------------------------------------------------
// Las líneas de venta: ver, crear, editar y borrar. Quién puede lo decide la
// ruta (ver con `analytics.read`, cambiar con `sales.manage`); aquí se validan
// los datos. Borrar una línea no toca ventas ni campañas: solo deja de existir
// esa forma de mirarlas.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toSalesLineSummary(line: SalesLine): SalesLineSummary {
  return {
    id: line.id,
    name: line.name,
    color: line.color,
    productIds: line.productIds,
    connectionIds: line.connectionIds,
    campaignIds: line.campaignIds,
    createdAt: line.createdAt,
    updatedAt: line.updatedAt
  };
}

export class SalesLineServices {
  public constructor(
    private readonly repository: SalesLineRepository,
    private readonly newId: () => string = randomUUID
  ) {}

  public async list(tenantId: string, canManage: boolean): Promise<SalesLineListResponse> {
    return { lines: (await this.repository.list(tenantId)).map(toSalesLineSummary), canManage };
  }

  /** La línea de la cuenta, o `null` (no existe o es de otra cuenta). Para el Dashboard y el MCP. */
  public async find(tenantId: string, id: string): Promise<SalesLine | null> {
    return UUID.test(id) ? this.repository.find(tenantId, id) : null;
  }

  public async create(tenantId: string, input: Partial<SaveSalesLineRequest>): Promise<SalesLineSummary> {
    const draft = salesLineDraft(input);
    if ((await this.repository.count(tenantId)) >= SALES_LINES_PER_TENANT_MAX) {
      throw new ValidationError(`La cuenta llegó a ${SALES_LINES_PER_TENANT_MAX} líneas. Borra las que ya no uses.`);
    }
    if (await this.repository.nameTaken(tenantId, draft.name)) throw new ConflictError(`Ya tienes una línea llamada «${draft.name}».`);
    return toSalesLineSummary(await this.repository.create(tenantId, this.newId(), draft));
  }

  public async update(tenantId: string, id: string, input: Partial<SaveSalesLineRequest>): Promise<SalesLineSummary> {
    const current = await this.require(tenantId, id);
    // Lo que no llega queda como estaba (editar solo el color no borra los productos).
    const draft = salesLineDraft({
      name: input.name ?? current.name,
      color: input.color ?? current.color,
      productIds: input.productIds ?? current.productIds,
      connectionIds: input.connectionIds ?? current.connectionIds,
      campaignIds: input.campaignIds ?? current.campaignIds
    });
    if (await this.repository.nameTaken(tenantId, draft.name, id)) throw new ConflictError(`Ya tienes una línea llamada «${draft.name}».`);
    const saved = await this.repository.update(tenantId, id, draft);
    if (!saved) throw new NotFoundError("Esa línea no existe.");
    return toSalesLineSummary(saved);
  }

  public async remove(tenantId: string, id: string): Promise<void> {
    await this.require(tenantId, id);
    await this.repository.remove(tenantId, id);
  }

  private async require(tenantId: string, id: string): Promise<SalesLine> {
    const line = await this.find(tenantId, id);
    if (!line) throw new NotFoundError("Esa línea no existe.");
    return line;
  }
}
