import type { McpCredential } from "../../../domains/mcp/domain/McpCredential";
import type { McpCredentialRepository } from "../../../domains/mcp/application/McpCredentialRepository";

/** Credenciales MCP en memoria (pruebas y desarrollo sin base). */
export class InMemoryMcpCredentialRepository implements McpCredentialRepository {
  public readonly credentials = new Map<string, McpCredential>();

  public async list(tenantId: string) {
    return [...this.credentials.values()].filter((credential) => credential.tenantId === tenantId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async findByHash(tokenHash: string) {
    return [...this.credentials.values()].find((credential) => credential.tokenHash === tokenHash) ?? null;
  }

  public async create(credential: McpCredential) {
    this.credentials.set(credential.id, credential);
  }

  public async remove(tenantId: string, id: string) {
    const current = this.credentials.get(id);
    if (!current || current.tenantId !== tenantId) return false;
    this.credentials.delete(id);
    return true;
  }

  public async touch(id: string, at: string) {
    const current = this.credentials.get(id);
    if (current) this.credentials.set(id, { ...current, lastUsedAt: at });
  }
}
