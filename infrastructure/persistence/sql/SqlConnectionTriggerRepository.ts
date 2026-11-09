import type { ConnectionTriggerRepository } from "../../../domains/connections/application/ConnectionTriggerRepository";
import type { ConnectionTriggerRecord } from "../../../domains/connections/domain/ConnectionTriggerRecord";
import type { ConnectionTriggerType, KeywordMatch } from "../../../contracts/ConnectionTriggerContracts";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

interface Row {
  id: string;
  tenant_id: string;
  connection_id: string;
  automation_id: string;
  type: ConnectionTriggerType;
  keywords: string[];
  match: KeywordMatch;
  enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = "id, tenant_id, connection_id, automation_id, type, keywords, match, enabled, created_at, updated_at";

function toRecord(row: Row): ConnectionTriggerRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    connectionId: row.connection_id,
    automationId: row.automation_id,
    type: row.type,
    keywords: row.keywords,
    match: row.match,
    enabled: row.enabled,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

/** Disparadores en PostgreSQL (`013_connection_triggers.sql`). Todo filtra por cuenta. */
export class SqlConnectionTriggerRepository implements ConnectionTriggerRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async listByConnection(tenantId: string, connectionId: string): Promise<ConnectionTriggerRecord[]> {
    if (!isUuid(tenantId) || !isUuid(connectionId)) return [];
    const result = await this.sql.query<Row>(
      `select ${COLUMNS} from connection_triggers where tenant_id = $1 and connection_id = $2 order by created_at, id`,
      [tenantId, connectionId]
    );
    return result.rows.map(toRecord);
  }

  public async findById(tenantId: string, id: string): Promise<ConnectionTriggerRecord | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<Row>(`select ${COLUMNS} from connection_triggers where tenant_id = $1 and id = $2`, [tenantId, id]);
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  public async countByConnection(tenantId: string): Promise<ReadonlyMap<string, number>> {
    if (!isUuid(tenantId)) return new Map();
    const result = await this.sql.query<{ connection_id: string; n: number }>(
      "select connection_id, count(*)::int as n from connection_triggers where tenant_id = $1 group by connection_id",
      [tenantId]
    );
    return new Map(result.rows.map((row) => [row.connection_id, row.n]));
  }

  public async save(trigger: ConnectionTriggerRecord): Promise<void> {
    try {
      await this.sql.query(
        `insert into connection_triggers (${COLUMNS})
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set
           automation_id = excluded.automation_id, type = excluded.type, keywords = excluded.keywords,
           match = excluded.match, enabled = excluded.enabled, updated_at = excluded.updated_at
         where connection_triggers.tenant_id = excluded.tenant_id`,
        [
          trigger.id, trigger.tenantId, trigger.connectionId, trigger.automationId, trigger.type,
          [...trigger.keywords], trigger.match, trigger.enabled, trigger.createdAt, trigger.updatedAt
        ]
      );
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "23505") throw new ConflictError("Este número ya tiene un disparador de ese tipo.");
      throw error;
    }
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(tenantId) || !isUuid(id)) return false;
    const result = await this.sql.query("delete from connection_triggers where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rowCount > 0;
  }
}
