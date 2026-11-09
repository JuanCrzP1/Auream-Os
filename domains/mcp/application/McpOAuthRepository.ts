import type { OAuthClient, OAuthCode, OAuthTokenSet } from "../domain/OAuth";

/**
 * Persistencia de OAuth del servidor MCP: agentes registrados, códigos de
 * autorización y tokens. Los códigos y los tokens de renovación se TOMAN
 * (se leen y se borran a la vez): así sirven una sola vez aunque lleguen dos
 * peticiones iguales al tiempo. Todo se guarda como huella SHA-256.
 */
export interface McpOAuthRepository {
  createClient(client: OAuthClient): Promise<void>;
  findClient(clientId: string): Promise<OAuthClient | null>;
  saveCode(code: OAuthCode): Promise<void>;
  takeCode(codeHash: string): Promise<OAuthCode | null>;
  saveTokens(tokens: OAuthTokenSet): Promise<void>;
  takeRefresh(refreshHash: string): Promise<OAuthTokenSet | null>;
}
