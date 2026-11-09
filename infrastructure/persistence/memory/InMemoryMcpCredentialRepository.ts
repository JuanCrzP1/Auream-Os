import type { McpCredential } from "../../../domains/mcp/domain/McpCredential";
import type { McpCredentialRepository } from "../../../domains/mcp/application/McpCredentialRepository";
import type { InMemoryMcpOAuthRepository } from "./InMemoryMcpOAuthRepository";

/**
 * Credenciales MCP en memoria (pruebas y desarrollo sin base). Con el
 * repositorio OAuth en memoria, encuentra las de OAuth por su token de acceso
 * y borra sus códigos y tokens con ellas (como las claves foráneas en Neon).
 */
export class InMemoryMcpCredentialRepository implements McpCredentialRepository {
  public readonly credentials = new Map<string, McpCredential>();

  public constructor(private readonly oauth?: InMemoryMcpOAuthRepository) {}

  public async list(tenantId: string) {
    return [...this.credentials.values()].filter((credential) => credential.tenantId === tenantId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public async findByHash(tokenHash: string) {
    return [...this.credentials.values()].find((credential) => credential.tokenHash === tokenHash) ?? null;
  }

  public async findByAccessHash(accessHash: string, now: string) {
    const tokens = this.oauth ? [...this.oauth.tokens.values()].find((item) => item.accessHash === accessHash && item.accessExpiresAt > now) : undefined;
    return tokens ? (this.credentials.get(tokens.credentialId) ?? null) : null;
  }

  public async create(credential: McpCredential) {
    this.credentials.set(credential.id, credential);
  }

  public async remove(tenantId: string, id: string) {
    const current = this.credentials.get(id);
    if (!current || current.tenantId !== tenantId) return false;
    this.delete(id);
    return true;
  }

  public async removeByClient(tenantId: string, clientId: string) {
    for (const credential of [...this.credentials.values()]) if (credential.tenantId === tenantId && credential.clientId === clientId) this.delete(credential.id);
  }

  public async touch(id: string, at: string) {
    const current = this.credentials.get(id);
    if (current) this.credentials.set(id, { ...current, lastUsedAt: at });
  }

  private delete(id: string) {
    this.credentials.delete(id);
    this.oauth?.forgetCredential(id);
  }
}
