import type { McpPermissions } from "../../../contracts/McpContracts";
import type { McpCredential } from "../../../domains/mcp/domain/McpCredential";
import type { McpCredentialRepository } from "../../../domains/mcp/application/McpCredentialRepository";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// Credenciales MCP en Neon (`025_mcp_credentials.sql`): por cuenta; la huella del token es única.

const COLUMNS = "id, tenant_id, name, permissions, token_hash, hint, created_at, last_used_at, expires_at";

interface Row {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly permissions: McpPermissions;
  readonly token_hash: string;
  readonly hint: string;
  readonly created_at: Date | string;
  readonly last_used_at: Date | string | null;
  readonly expires_at: Date | string | null;
}

function toCredential(row: Row): McpCredential {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    permissions: row.permissions ?? {},
    tokenHash: row.token_hash,
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

  public async create(credential: McpCredential): Promise<void> {
    await this.sql.query(
      `insert into mcp_credentials (${COLUMNS}) values ($1, $2, $3, $4::jsonb, $5, $6, $7, null, $8)`,
      [credential.id, credential.tenantId, credential.name, JSON.stringify(credential.permissions), credential.tokenHash, credential.hint, credential.createdAt, credential.expiresAt]
    );
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    return (await this.sql.query("delete from mcp_credentials where tenant_id = $1 and id = $2", [tenantId, id])).rowCount > 0;
  }

  public async touch(id: string, at: string): Promise<void> {
    await this.sql.query("update mcp_credentials set last_used_at = $2 where id = $1", [id, at]);
  }
}
