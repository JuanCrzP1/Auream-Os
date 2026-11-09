import type { McpCredentialKind, McpPermissions } from "../../../contracts/McpContracts";
import type { McpCredential } from "../../../domains/mcp/domain/McpCredential";
import type { McpCredentialRepository } from "../../../domains/mcp/application/McpCredentialRepository";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// Credenciales MCP en Neon (`025_mcp_credentials.sql`, `026_mcp_oauth.sql`): por
// cuenta; la huella del token es única. Las de OAuth se encuentran por la
// huella de un token de acceso vigente (`mcp_oauth_tokens`).

const COLUMNS = "id, tenant_id, kind, name, permissions, token_hash, client_id, hint, created_at, last_used_at, expires_at";
const QUALIFIED = COLUMNS.split(", ").map((column) => `c.${column}`).join(", ");

interface Row {
  readonly id: string;
  readonly tenant_id: string;
  readonly kind: McpCredentialKind;
  readonly name: string;
  readonly permissions: McpPermissions;
  readonly token_hash: string | null;
  readonly client_id: string | null;
  readonly hint: string;
  readonly created_at: Date | string;
  readonly last_used_at: Date | string | null;
  readonly expires_at: Date | string | null;
}

function toCredential(row: Row): McpCredential {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    kind: row.kind,
    name: row.name,
    permissions: row.permissions ?? {},
    tokenHash: row.token_hash,
    clientId: row.client_id,
    hint: row.hint,
    createdAt: toIso(row.created_at),
    lastUsedAt: row.last_used_at ? toIso(row.last_used_at) : null,
    expiresAt: row.expires_at ? toIso(row.expires_at) : null
  };
}

export class SqlMcpCredentialRepository implements McpCredentialRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string): Promise<McpCredential[]> {
    return (await this.sql.query<Row>(`select ${COLUMNS} from mcp_credentials where tenant_id = $1 order by created_at`, [tenantId])).rows.map(toCredential);
  }

  public async findByHash(tokenHash: string): Promise<McpCredential | null> {
    const row = (await this.sql.query<Row>(`select ${COLUMNS} from mcp_credentials where token_hash = $1`, [tokenHash])).rows[0];
    return row ? toCredential(row) : null;
  }

  public async findByAccessHash(accessHash: string, now: string): Promise<McpCredential | null> {
    const row = (
      await this.sql.query<Row>(
        `select ${QUALIFIED} from mcp_oauth_tokens t join mcp_credentials c on c.id = t.credential_id where t.access_hash = $1 and t.access_expires_at > $2`,
        [accessHash, now]
      )
    ).rows[0];
    return row ? toCredential(row) : null;
  }

  public async create(credential: McpCredential): Promise<void> {
    await this.sql.query(
      `insert into mcp_credentials (${COLUMNS}) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, null, $10)`,
      [
        credential.id,
        credential.tenantId,
        credential.kind,
        credential.name,
        JSON.stringify(credential.permissions),
        credential.tokenHash,
        credential.clientId,
        credential.hint,
        credential.createdAt,
        credential.expiresAt
      ]
    );
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    return (await this.sql.query("delete from mcp_credentials where tenant_id = $1 and id = $2", [tenantId, id])).rowCount > 0;
  }

  public async removeByClient(tenantId: string, clientId: string): Promise<void> {
    await this.sql.query("delete from mcp_credentials where tenant_id = $1 and client_id = $2", [tenantId, clientId]);
  }

  public async touch(id: string, at: string): Promise<void> {
    await this.sql.query("update mcp_credentials set last_used_at = $2 where id = $1", [id, at]);
  }
}
