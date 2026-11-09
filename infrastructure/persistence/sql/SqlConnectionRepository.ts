import type { ConnectionRepository } from "../../../domains/connections/application/ConnectionRepository";
import type { WhatsAppConnection } from "../../../domains/connections/domain/WhatsAppConnection";
import type { ConnectionMethod, ConnectionStatus } from "../../../contracts/ConnectionContracts";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

interface Row {
  id: string;
  tenant_id: string;
  name: string;
  method: ConnectionMethod;
  status: ConnectionStatus;
  phone_number: string | null;
  profile_name: string | null;
  provider_ref: string | null;
  last_connected_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = "id, tenant_id, name, method, status, phone_number, profile_name, provider_ref, last_connected_at, created_at, updated_at";

function toConnection(row: Row): WhatsAppConnection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    method: row.method,
    status: row.status,
    phoneNumber: row.phone_number,
    profileName: row.profile_name,
    providerRef: row.provider_ref,
    lastConnectedAt: row.last_connected_at === null ? null : toIso(row.last_connected_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

/** Conexiones de WhatsApp en PostgreSQL (`011_whatsapp_connections.sql`). Todo filtra por cuenta. */
export class SqlConnectionRepository implements ConnectionRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async listByTenant(tenantId: string): Promise<WhatsAppConnection[]> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<Row>(`select ${COLUMNS} from whatsapp_connections where tenant_id = $1 order by created_at`, [tenantId]);
    return result.rows.map(toConnection);
  }

  public async findById(tenantId: string, id: string): Promise<WhatsAppConnection | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<Row>(`select ${COLUMNS} from whatsapp_connections where tenant_id = $1 and id = $2`, [tenantId, id]);
    return result.rows[0] ? toConnection(result.rows[0]) : null;
  }

  public async save(connection: WhatsAppConnection): Promise<void> {
    try {
      await this.sql.query(
        `insert into whatsapp_connections (${COLUMNS})
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (id) do update set
           name = excluded.name, status = excluded.status, phone_number = excluded.phone_number,
           profile_name = excluded.profile_name, provider_ref = excluded.provider_ref,
           last_connected_at = excluded.last_connected_at, updated_at = excluded.updated_at
         where whatsapp_connections.tenant_id = excluded.tenant_id`,
        [
          connection.id, connection.tenantId, connection.name, connection.method, connection.status, connection.phoneNumber,
          connection.profileName, connection.providerRef, connection.lastConnectedAt, connection.createdAt, connection.updatedAt
        ]
      );
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "23505") throw new ConflictError(`Ya tienes una conexión llamada «${connection.name}».`);
      throw error;
    }
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(tenantId) || !isUuid(id)) return false;
    const result = await this.sql.query("delete from whatsapp_connections where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rowCount > 0;
  }
}
