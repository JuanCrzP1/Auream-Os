import type { AiCredentialRepository } from "../../../domains/integrations/application/AiCredentialRepository";
import type { AiCredential } from "../../../domains/integrations/domain/AiCredential";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";

/** Conexiones de IA en memoria (tests). Mismas reglas que la versión SQL. */
export class InMemoryAiCredentialRepository implements AiCredentialRepository {
  private items: AiCredential[] = [];

  public async listByTenant(tenantId: string): Promise<AiCredential[]> {
    return this.items.filter((item) => item.tenantId === tenantId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async findById(tenantId: string, id: string): Promise<AiCredential | null> {
    return this.items.find((item) => item.tenantId === tenantId && item.id === id) ?? null;
  }

  public async save(credential: AiCredential): Promise<void> {
    const clash = this.items.find(
      (item) => item.tenantId === credential.tenantId && item.id !== credential.id && item.name.toLowerCase() === credential.name.toLowerCase()
    );
    if (clash) throw new ConflictError(`Ya tienes una conexión de IA llamada «${credential.name}».`);
    const index = this.items.findIndex((item) => item.id === credential.id && item.tenantId === credential.tenantId);
    if (index >= 0) this.items[index] = credential;
    else this.items.push(credential);
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    const before = this.items.length;
    this.items = this.items.filter((item) => !(item.tenantId === tenantId && item.id === id));
    return this.items.length < before;
  }
}
