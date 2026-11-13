import type { BusinessDatum } from "../../../contracts/BusinessDataContracts";
import type { BusinessDataRepository } from "../../../domains/business-data/application/BusinessDataPorts";
import type { DatumShape } from "../../../domains/business-data/domain/BusinessDatum";

// Datos del negocio en memoria (pruebas y almacén sin base). Cada cuenta ve solo los suyos.

export class InMemoryBusinessDataRepository implements BusinessDataRepository {
  private readonly rows = new Map<string, BusinessDatum & { readonly tenantId: string }>();
  private clock = 0;

  public async list(tenantId: string): Promise<BusinessDatum[]> {
    return [...this.rows.values()].filter((row) => row.tenantId === tenantId).map(({ tenantId: _tenant, ...datum }) => datum);
  }

  public async find(tenantId: string, id: string): Promise<BusinessDatum | null> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return null;
    const { tenantId: _tenant, ...datum } = row;
    return datum;
  }

  public async create(tenantId: string, id: string, datum: DatumShape): Promise<BusinessDatum | null> {
    if ([...this.rows.values()].some((row) => row.tenantId === tenantId && row.key === datum.key)) return null;
    const at = new Date(Date.UTC(2026, 10, 13, 0, 0, this.clock++)).toISOString();
    this.rows.set(id, { ...datum, id, tenantId, createdAt: at, updatedAt: at });
    return this.find(tenantId, id);
  }

  public async update(tenantId: string, id: string, datum: DatumShape): Promise<BusinessDatum | null> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return null;
    this.rows.set(id, { ...row, ...datum, key: row.key, updatedAt: new Date(Date.UTC(2026, 10, 13, 1, 0, this.clock++)).toISOString() });
    return this.find(tenantId, id);
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return false;
    return this.rows.delete(id);
  }
}
