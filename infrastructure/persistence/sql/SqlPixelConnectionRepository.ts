import type { PixelConnectionRepository } from "../../../domains/integrations/application/PixelConnectionRepository";
import type { PixelConnection } from "../../../domains/integrations/domain/PixelConnection";
import type { PixelConnectionStatus } from "../../../contracts/PixelContracts";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

interface Row {
  id: string;
  tenant_id: string;
  name: string;
  pixel_id: string;
  secret: string;
  token_hint: string;
  status: PixelConnectionStatus;
  last_verified_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = "id, tenant_id, name, pixel_id, secret, token_hint, status, last_verified_at, created_at, updated_at";

function toConnection(row: Row): PixelConnection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    pixelId: row.pixel_id,
    secret: row.secret,
    tokenHint: row.token_hint,
    status: row.status,
    lastVerifiedAt: row.last_verified_at === null ? null : toIso(row.last_verified_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

/** Píxeles de Meta en PostgreSQL (`009_pixel_connections.sql`). Todo filtra por cuenta. */
export class SqlPixelConnectionRepository implements PixelConnectionRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async listByTenant(tenantId: string): Promise<PixelConnection[]> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<Row>(`select ${COLUMNS} from pixel_connections where tenant_id = $1 order by created_at`, [tenantId]);
    return result.rows.map(toConnection);
  }

  public async findById(tenantId: string, id: string): Promise<PixelConnection | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<Row>(`select ${COLUMNS} from pixel_connections where tenant_id = $1 and id = $2`, [tenantId, id]);
    return result.rows[0] ? toConnection(result.rows[0]) : null;
  }

  public async save(connection: PixelConnection): Promise<void> {
    try {
      await this.sql.query(
        `insert into pixel_connections (${COLUMNS})
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set
           name = excluded.name, secret = excluded.secret, token_hint = excluded.token_hint,
           status = excluded.status, last_verified_at = excluded.last_verified_at, updated_at = excluded.updated_at
         where pixel_connections.tenant_id = excluded.tenant_id`,
        [
          connection.id, connection.tenantId, connection.name, connection.pixelId, connection.secret, connection.tokenHint,
          connection.status, connection.lastVerifiedAt, connection.createdAt, connection.updatedAt
        ]
      );
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "23505") throw new ConflictError(`Ya tienes un píxel llamado «${connection.name}».`);
      throw error;
    }
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(tenantId) || !isUuid(id)) return false;
    const result = await this.sql.query("delete from pixel_connections where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rowCount > 0;
  }
}
