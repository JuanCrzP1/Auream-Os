import type { SessionRepository } from "../../../domains/sessions/application/SessionRepository";
import type { Session, SessionStatus } from "../../../contracts/RuntimeContracts";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

interface Row {
  id: string;
  tenant_id: string;
  flow_id: string;
  flow_version_id: string;
  channel: string;
  conversation_key: string;
  user_key: string;
  current_node_id: string;
  status: SessionStatus;
  revision: number;
  context: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS =
  "id, tenant_id, flow_id, flow_version_id, channel, conversation_key, user_key, current_node_id, status, revision, context, created_at, updated_at";

function toSession(row: Row): Session {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    flowId: row.flow_id,
    flowVersionId: row.flow_version_id,
    channel: row.channel,
    conversationKey: row.conversation_key,
    userKey: row.user_key,
    currentNodeId: row.current_node_id,
    status: row.status,
    revision: row.revision,
    context: row.context ?? {},
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

/** Sesiones de ejecución en PostgreSQL (`014_flow_sessions.sql`). */
export class SqlSessionRepository implements SessionRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async find(sessionId: string): Promise<Session | undefined> {
    const result = await this.sql.query<Row>(`select ${COLUMNS} from flow_sessions where id = $1`, [sessionId]);
    return result.rows[0] ? toSession(result.rows[0]) : undefined;
  }

  public async save(session: Session): Promise<void> {
    if (!isUuid(session.tenantId)) throw new Error("La sesión no pertenece a una cuenta válida.");
    await this.sql.query(
      `insert into flow_sessions (${COLUMNS})
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
       on conflict (id) do update set
         flow_id = excluded.flow_id, flow_version_id = excluded.flow_version_id, channel = excluded.channel,
         user_key = excluded.user_key, current_node_id = excluded.current_node_id, status = excluded.status,
         revision = excluded.revision, context = excluded.context, created_at = excluded.created_at,
         updated_at = excluded.updated_at
       where flow_sessions.tenant_id = excluded.tenant_id`,
      [
        session.id, session.tenantId, session.flowId, session.flowVersionId, session.channel, session.conversationKey, session.userKey,
        session.currentNodeId, session.status, session.revision, JSON.stringify(session.context), session.createdAt, session.updatedAt
      ]
    );
  }
}
