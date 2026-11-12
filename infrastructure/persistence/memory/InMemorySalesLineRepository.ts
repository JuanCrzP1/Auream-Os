import type { SalesLineRepository } from "../../../domains/sales-lines/application/SalesLineRepository";
import type { SalesLine, SalesLineDraft } from "../../../domains/sales-lines/domain/SalesLine";

/** Líneas de venta en memoria (pruebas). Mismas reglas que la versión SQL. */
export class InMemorySalesLineRepository implements SalesLineRepository {
  public readonly lines = new Map<string, SalesLine>();

  public async list(tenantId: string): Promise<SalesLine[]> {
    return [...this.lines.values()].filter((line) => line.tenantId === tenantId).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }

  public async find(tenantId: string, id: string): Promise<SalesLine | null> {
    const line = this.lines.get(id);
    return line && line.tenantId === tenantId ? line : null;
  }

  public async count(tenantId: string): Promise<number> {
    return (await this.list(tenantId)).length;
  }

  public async nameTaken(tenantId: string, name: string, exceptId?: string): Promise<boolean> {
    return (await this.list(tenantId)).some((line) => line.id !== exceptId && line.name.toLowerCase() === name.trim().toLowerCase());
  }

  public async create(tenantId: string, id: string, draft: SalesLineDraft): Promise<SalesLine> {
    const at = new Date().toISOString();
    const line: SalesLine = { id, tenantId, ...draft, createdAt: at, updatedAt: at };
    this.lines.set(id, line);
    return line;
  }

  public async update(tenantId: string, id: string, draft: SalesLineDraft): Promise<SalesLine | null> {
    const current = await this.find(tenantId, id);
    if (!current) return null;
    const line: SalesLine = { ...current, ...draft, updatedAt: new Date().toISOString() };
    this.lines.set(id, line);
    return line;
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    return (await this.find(tenantId, id)) ? this.lines.delete(id) : false;
  }
}
