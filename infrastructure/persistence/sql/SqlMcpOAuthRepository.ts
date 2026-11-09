import type { McpOAuthRepository } from "../../../domains/mcp/application/McpOAuthRepository";
import type { OAuthClient, OAuthCode, OAuthTokenSet } from "../../../domains/mcp/domain/OAuth";
import type { SqlClient } from "./SqlClient";
import { toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// OAuth del servidor MCP en Neon (`026_mcp_oauth.sql`). Tomar un código o un
// token de renovación es un `delete … returning`: atómico, sirve una sola vez.
// Al guardar uno nuevo se limpian los vencidos (no hace falta otro trabajo).
// ---------------------------------------------------------------------------

interface ClientRow {
  readonly client_id: string;
  readonly name: string;
  readonly redirect_uris: string[];
  readonly created_at: Date | string;
}

interface CodeRow {
  readonly code_hash: string;
  readonly client_id: string;
  readonly credential_id: string;
  readonly redirect_uri: string;
  readonly code_challenge: string;
  readonly resource: string | null;
  readonly expires_at: Date | string;
}

interface TokenRow {
  readonly id: string;
  readonly credential_id: string;
  readonly client_id: string;
  readonly access_hash: string;
  readonly access_expires_at: Date | string;
  readonly refresh_hash: string;
  readonly refresh_expires_at: Date | string;
}

const toTokens = (row: TokenRow): OAuthTokenSet => ({
  id: row.id,
  credentialId: row.credential_id,
  clientId: row.client_id,
  accessHash: row.access_hash,
  accessExpiresAt: toIso(row.access_expires_at),
  refreshHash: row.refresh_hash,
  refreshExpiresAt: toIso(row.refresh_expires_at)
});

export class SqlMcpOAuthRepository implements McpOAuthRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async createClient(client: OAuthClient): Promise<void> {
    await this.sql.query("insert into mcp_oauth_clients (client_id, name, redirect_uris, created_at) values ($1, $2, $3::jsonb, $4)", [
      client.clientId,
      client.name,
      JSON.stringify(client.redirectUris),
      client.createdAt
    ]);
  }

  public async findClient(clientId: string): Promise<OAuthClient | null> {
    const row = (await this.sql.query<ClientRow>("select client_id, name, redirect_uris, created_at from mcp_oauth_clients where client_id = $1", [clientId])).rows[0];
    return row ? { clientId: row.client_id, name: row.name, redirectUris: row.redirect_uris, createdAt: toIso(row.created_at) } : null;
  }

  public async saveCode(code: OAuthCode): Promise<void> {
    await this.sql.query("delete from mcp_oauth_codes where expires_at < now()");
    await this.sql.query(
      "insert into mcp_oauth_codes (code_hash, client_id, credential_id, redirect_uri, code_challenge, resource, expires_at) values ($1, $2, $3, $4, $5, $6, $7)",
      [code.codeHash, code.clientId, code.credentialId, code.redirectUri, code.codeChallenge, code.resource, code.expiresAt]
    );
  }

  public async takeCode(codeHash: string): Promise<OAuthCode | null> {
    const row = (
      await this.sql.query<CodeRow>(
        "delete from mcp_oauth_codes where code_hash = $1 returning code_hash, client_id, credential_id, redirect_uri, code_challenge, resource, expires_at",
        [codeHash]
      )
    ).rows[0];
    return row
      ? {
          codeHash: row.code_hash,
          clientId: row.client_id,
          credentialId: row.credential_id,
          redirectUri: row.redirect_uri,
          codeChallenge: row.code_challenge,
          resource: row.resource,
          expiresAt: toIso(row.expires_at)
        }
      : null;
  }

  public async saveTokens(tokens: OAuthTokenSet): Promise<void> {
    await this.sql.query("delete from mcp_oauth_tokens where refresh_expires_at < now()");
    await this.sql.query(
      "insert into mcp_oauth_tokens (id, credential_id, client_id, access_hash, access_expires_at, refresh_hash, refresh_expires_at) values ($1, $2, $3, $4, $5, $6, $7)",
      [tokens.id, tokens.credentialId, tokens.clientId, tokens.accessHash, tokens.accessExpiresAt, tokens.refreshHash, tokens.refreshExpiresAt]
    );
  }

  public async takeRefresh(refreshHash: string): Promise<OAuthTokenSet | null> {
    const row = (
      await this.sql.query<TokenRow>(
        "delete from mcp_oauth_tokens where refresh_hash = $1 returning id, credential_id, client_id, access_hash, access_expires_at, refresh_hash, refresh_expires_at",
        [refreshHash]
      )
    ).rows[0];
    return row ? toTokens(row) : null;
  }
}
