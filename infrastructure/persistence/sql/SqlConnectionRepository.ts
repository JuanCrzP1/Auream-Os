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
  profile_picture_url: string | null;
  provider_ref: string | null;
  provider_secret: string | null;
  last_connected_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = "id, tenant_id, name, method, status, phone_number, profile_name, profile_picture_url, provider_ref, provider_secret, last_connected_at, created_at, updated_at";

function toConnection(row: Row): WhatsAppConnection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    method: row.method,
    status: row.status,
    phoneNumber: row.phone_number,
    profileName: row.profile_name,
    profilePictureUrl: row.profile_picture_url,
    providerRef: row.provider_ref,
    providerSecret: row.provider_secret,
    lastConnectedAt: row.last_connected_at === null ? null : toIso(row.last_connected_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

/**
 * Conexiones de WhatsApp en PostgreSQL (`011_whatsapp_connections.sql`). Todo
 * filtra por cuenta. Una conexión eliminada (`018_connection_soft_delete.sql`)
 * no aparece en ninguna lectura: solo queda para el historial de sus chats.
 */
export class SqlConnectionRepository implements ConnectionRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async listByTenant(tenantId: string): Promise<WhatsAppConnection[]> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<Row>(`select ${COLUMNS} from whatsapp_connections where tenant_id = $1 and deleted_at is null order by created_at`, [tenantId]);
    return result.rows.map(toConnection);
  }

  public async findById(tenantId: string, id: string): Promise<WhatsAppConnection | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<Row>(`select ${COLUMNS} from whatsapp_connections where tenant_id = $1 and id = $2 and deleted_at is null`, [tenantId, id]);
    return result.rows[0] ? toConnection(result.rows[0]) : null;
  }

  public async findForProvider(id: string): Promise<WhatsAppConnection | null> {
    if (!isUuid(id)) return null;
    const result = await this.sql.query<Row>(`select ${COLUMNS} from whatsapp_connections where id = $1 and deleted_at is null`, [id]);
    return result.rows[0] ? toConnection(result.rows[0]) : null;
  }

  public async save(connection: WhatsAppConnection): Promise<void> {
    try {
      await this.sql.query(
        `insert into whatsapp_connections (${COLUMNS})
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         on conflict (id) do update set
           name = excluded.name, status = excluded.status, phone_number = excluded.phone_number,
           profile_name = excluded.profile_name, profile_picture_url = excluded.profile_picture_url, provider_ref = excluded.provider_ref, provider_secret = excluded.provider_secret,
           last_connected_at = excluded.last_connected_at, updated_at = excluded.updated_at
         where whatsapp_connections.tenant_id = excluded.tenant_id and whatsapp_connections.deleted_at is null`,
        [
          connection.id, connection.tenantId, connection.name, connection.method, connection.status, connection.phoneNumber,
          connection.profileName, connection.profilePictureUrl, connection.providerRef, connection.providerSecret, connection.lastConnectedAt, connection.createdAt, connection.updatedAt
        ]
      );
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "23505") throw new ConflictError(`Ya tienes una conexión llamada «${connection.name}».`);
      throw error;
    }
  }

  /** Una sola sentencia: solo actualiza si la sesión guardada sigue siendo `expectedRef`. */
  public async saveIfSession(connection: WhatsAppConnection, expectedRef: string | null): Promise<boolean> {
    if (!isUuid(connection.tenantId) || !isUuid(connection.id)) return false;
    const result = await this.sql.query<{ id: string }>(
      `update whatsapp_connections
          set status = $3, phone_number = $4, profile_name = $5, profile_picture_url = $6, provider_ref = $7, provider_secret = $8,
              last_connected_at = $9, updated_at = $10
        where tenant_id = $1 and id = $2 and deleted_at is null and provider_ref is not distinct from $11
       returning id`,
      [
        connection.tenantId, connection.id, connection.status, connection.phoneNumber, connection.profileName, connection.profilePictureUrl,
        connection.providerRef, connection.providerSecret, connection.lastConnectedAt, connection.updatedAt, expectedRef
      ]
    );
    return result.rows.length > 0;
  }

  /**
   * La marca como eliminada en una sola sentencia: desconectada, sin
   * credencial y sin disparadores. La fila queda para el historial de chats.
   */
  public async delete(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(tenantId) || !isUuid(id)) return false;
    const result = await this.sql.query<{ removed: number }>(
      `with removed as (
         update whatsapp_connections
            set deleted_at = now(), status = 'disconnected', provider_secret = null, updated_at = now()
          where tenant_id = $1 and id = $2 and deleted_at is null
         returning id
       ), dropped_triggers as (
         delete from connection_triggers t using removed where t.connection_id = removed.id
       )
       select count(*)::int as removed from removed`,
      [tenantId, id]
    );
    return (result.rows[0]?.removed ?? 0) > 0;
  }
}
