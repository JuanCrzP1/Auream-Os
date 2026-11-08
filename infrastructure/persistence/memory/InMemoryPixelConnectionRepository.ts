import type { PixelConnectionRepository } from "../../../domains/integrations/application/PixelConnectionRepository";
import type { PixelConnection } from "../../../domains/integrations/domain/PixelConnection";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";

/** Píxeles en memoria (tests). Mismas reglas que la versión SQL. */
export class InMemoryPixelConnectionRepository implements PixelConnectionRepository {
  private items: PixelConnection[] = [];

  public async listByTenant(tenantId: string): Promise<PixelConnection[]> {
    return this.items.filter((item) => item.tenantId === tenantId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async findById(tenantId: string, id: string): Promise<PixelConnection | null> {
    return this.items.find((item) => item.tenantId === tenantId && item.id === id) ?? null;
  }

  public async save(connection: PixelConnection): Promise<void> {
    const clash = this.items.find((item) => item.tenantId === connection.tenantId && item.id !== connection.id && item.name.toLowerCase() === connection.name.toLowerCase());
    if (clash) throw new ConflictError(`Ya tienes un píxel llamado «${connection.name}».`);
    const index = this.items.findIndex((item) => item.id === connection.id && item.tenantId === connection.tenantId);
    if (index >= 0) this.items[index] = connection;
    else this.items.push(connection);
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((item) => !(item.tenantId === tenantId && item.id === id));
    return this.items.length < before;
  }
}
