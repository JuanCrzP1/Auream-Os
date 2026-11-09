import type { ConnectionRepository } from "../../../domains/connections/application/ConnectionRepository";
import type { WhatsAppConnection } from "../../../domains/connections/domain/WhatsAppConnection";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";

/** Conexiones en memoria (tests). Mismas reglas que la versión SQL. */
export class InMemoryConnectionRepository implements ConnectionRepository {
  private items: WhatsAppConnection[] = [];

  public async listByTenant(tenantId: string): Promise<WhatsAppConnection[]> {
    return this.items.filter((item) => item.tenantId === tenantId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async findById(tenantId: string, id: string): Promise<WhatsAppConnection | null> {
    return this.items.find((item) => item.tenantId === tenantId && item.id === id) ?? null;
  }

  public async save(connection: WhatsAppConnection): Promise<void> {
    const clash = this.items.find(
      (item) => item.tenantId === connection.tenantId && item.id !== connection.id && item.name.toLowerCase() === connection.name.toLowerCase()
    );
    if (clash) throw new ConflictError(`Ya tienes una conexión llamada «${connection.name}».`);
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
