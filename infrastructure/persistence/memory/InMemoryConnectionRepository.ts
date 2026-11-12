import type { ConnectionRepository } from "../../../domains/connections/application/ConnectionRepository";
import type { WhatsAppConnection } from "../../../domains/connections/domain/WhatsAppConnection";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";

/** Conexiones en memoria (tests). Mismas reglas que la versión SQL: eliminar no borra, la retira. */
export class InMemoryConnectionRepository implements ConnectionRepository {
  private items: WhatsAppConnection[] = [];
  /** Conexiones eliminadas (su historial de chats sigue existiendo). */
  public readonly removed: WhatsAppConnection[] = [];

  public async listByTenant(tenantId: string): Promise<WhatsAppConnection[]> {
    return this.items.filter((item) => item.tenantId === tenantId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async findById(tenantId: string, id: string): Promise<WhatsAppConnection | null> {
    return this.items.find((item) => item.tenantId === tenantId && item.id === id) ?? null;
  }

  public async findForProvider(id: string): Promise<WhatsAppConnection | null> {
    return this.items.find((item) => item.id === id) ?? null;
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

  public async saveIfSession(connection: WhatsAppConnection, expectedRef: string | null): Promise<boolean> {
    const current = this.items.find((item) => item.id === connection.id && item.tenantId === connection.tenantId);
    if (!current || current.providerRef !== expectedRef) return false;
    await this.save(connection);
    return true;
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const found = this.items.find((item) => item.tenantId === tenantId && item.id === id);
    if (!found) return false;
    this.items = this.items.filter((item) => item !== found);
    this.removed.push({ ...found, status: "disconnected", providerSecret: null });
    return true;
  }
}
