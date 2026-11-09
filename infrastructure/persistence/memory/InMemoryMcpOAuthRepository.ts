import type { McpOAuthRepository } from "../../../domains/mcp/application/McpOAuthRepository";
import type { OAuthClient, OAuthCode, OAuthTokenSet } from "../../../domains/mcp/domain/OAuth";

/** OAuth del servidor MCP en memoria (pruebas y desarrollo sin base). */
export class InMemoryMcpOAuthRepository implements McpOAuthRepository {
  public readonly clients = new Map<string, OAuthClient>();
  public readonly codes = new Map<string, OAuthCode>();
  public readonly tokens = new Map<string, OAuthTokenSet>();

  public async createClient(client: OAuthClient) {
    this.clients.set(client.clientId, client);
  }

  public async findClient(clientId: string) {
    return this.clients.get(clientId) ?? null;
  }

  public async saveCode(code: OAuthCode) {
    this.codes.set(code.codeHash, code);
  }

  public async takeCode(codeHash: string) {
    const code = this.codes.get(codeHash) ?? null;
    this.codes.delete(codeHash);
    return code;
  }

  public async saveTokens(tokens: OAuthTokenSet) {
    this.tokens.set(tokens.id, tokens);
  }

  public async takeRefresh(refreshHash: string) {
    const current = [...this.tokens.values()].find((item) => item.refreshHash === refreshHash) ?? null;
    if (current) this.tokens.delete(current.id);
    return current;
  }

  /** Al borrar una credencial se van sus códigos y tokens. */
  public forgetCredential(credentialId: string) {
    for (const [key, code] of this.codes) if (code.credentialId === credentialId) this.codes.delete(key);
    for (const [key, tokens] of this.tokens) if (tokens.credentialId === credentialId) this.tokens.delete(key);
  }
}
