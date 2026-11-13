import type { AgentMessagePart } from "../../../contracts/ConversationContracts";
import type { ScheduledMessageStatus } from "../../../contracts/ScheduledMessageContracts";
import type { StoredScheduledMessage } from "../../../domains/conversations/domain/ScheduledMessage";
import type {
  NewScheduledMessage,
  ScheduledMessageChanges,
  ScheduledMessageRepository,
  ScheduledOutcome
} from "../../../domains/conversations/application/ScheduledMessagePorts";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Mensajes programados (`046_scheduled_messages.sql`). Todo filtra por cuenta;
// el nombre de quien lo programó sale de su perfil actual. Tomarlo para
// enviarlo es un solo `update … where status = any(…)`: dos procesos a la vez,
// solo uno lo toma.
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  tenant_id: string;
  conversation_id: string;
  parts: AgentMessagePart[];
  send_at: Date | string;
  cancel_if_replied: boolean;
  status: ScheduledMessageStatus;
  error: string | null;
  author_id: string | null;
  author_name: string | null;
  armed_at: Date | string;
  claimed_at: Date | string | null;
  created_at: Date | string;
}

const COLUMNS = `m.id, m.tenant_id, m.conversation_id, m.parts, m.send_at, m.cancel_if_replied, m.status, m.error, m.author_id,
                 coalesce(u.display_name, u.email) as author_name, m.armed_at, m.claimed_at, m.created_at`;
const SELECT = `select ${COLUMNS} from scheduled_messages m left join user_profiles u on u.user_id = m.author_id`;
const OPEN = ["pending", "sending", "failed", "skipped"];

const toMessage = (row: Row): StoredScheduledMessage => ({
  id: row.id,
  tenantId: row.tenant_id,
  conversationId: row.conversation_id,
  parts: row.parts,
  sendAt: toIso(row.send_at),
  cancelIfReplied: row.cancel_if_replied,
  status: row.status,
  error: row.error,
  authorId: row.author_id,
  authorName: row.author_name,
  armedAt: toIso(row.armed_at),
  claimedAt: row.claimed_at === null ? null : toIso(row.claimed_at),
  createdAt: toIso(row.created_at)
});

export class SqlScheduledMessageRepository implements ScheduledMessageRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async open(tenantId: string, conversationId: string): Promise<StoredScheduledMessage[]> {
    if (!isUuid(tenantId) || !isUuid(conversationId)) return [];
    const { rows } = await this.sql.query<Row>(
      `${SELECT} where m.tenant_id = $1 and m.conversation_id = $2 and m.status = any($3::text[]) order by m.send_at, m.created_at limit 50`,
      [tenantId, conversationId, OPEN]
    );
    return rows.map(toMessage);
  }

  public async find(tenantId: string, id: string): Promise<StoredScheduledMessage | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const { rows } = await this.sql.query<Row>(`${SELECT} where m.tenant_id = $1 and m.id = $2`, [tenantId, id]);
    return rows[0] ? toMessage(rows[0]) : null;
  }

  public async countPending(tenantId: string, conversationId: string): Promise<number> {
    const { rows } = await this.sql.query<{ total: string }>(
      "select count(*) as total from scheduled_messages where tenant_id = $1 and conversation_id = $2 and status = 'pending'",
      [tenantId, conversationId]
    );
    return Number(rows[0]?.total ?? 0);
  }

  public async insert(message: NewScheduledMessage): Promise<void> {
    // Solo si el chat es de la cuenta (si no, no inserta nada).
    await this.sql.query(
      `insert into scheduled_messages (id, tenant_id, conversation_id, parts, send_at, cancel_if_replied, author_id)
       select $1, $2, $3, $4::jsonb, $5, $6, $7::uuid where exists (select 1 from conversations where tenant_id = $2 and id = $3)`,
      [message.id, message.tenantId, message.conversationId, JSON.stringify(message.parts), message.sendAt, message.cancelIfReplied, isUuid(message.authorId) ? message.authorId : null]
    );
  }

  public async update(tenantId: string, id: string, changes: ScheduledMessageChanges): Promise<boolean> {
    const { rowCount } = await this.sql.query(
      `update scheduled_messages set parts = $3::jsonb, send_at = $4, cancel_if_replied = $5, armed_at = $6
        where tenant_id = $1 and id = $2 and status = 'pending'`,
      [tenantId, id, JSON.stringify(changes.parts), changes.sendAt, changes.cancelIfReplied, changes.armedAt]
    );
    return rowCount > 0;
  }

  public async claim(tenantId: string, id: string, from: ReadonlyArray<ScheduledMessageStatus>, at: Date): Promise<StoredScheduledMessage | null> {
    const { rows } = await this.sql.query<{ id: string }>(
      `update scheduled_messages set status = 'sending', claimed_at = $4, error = null
        where tenant_id = $1 and id = $2 and status = any($3::text[]) returning id`,
      [tenantId, id, [...from], at]
    );
    return rows[0] ? this.find(tenantId, id) : null;
  }

  public async release(tenantId: string, id: string, to: ScheduledMessageStatus): Promise<void> {
    await this.sql.query("update scheduled_messages set status = $3, claimed_at = null where tenant_id = $1 and id = $2 and status = 'sending'", [tenantId, id, to]);
  }

  public async finish(tenantId: string, id: string, outcome: ScheduledOutcome, at: Date): Promise<void> {
    await this.sql.query(
      "update scheduled_messages set status = $3, error = $4, finished_at = $5 where tenant_id = $1 and id = $2 and status = 'sending'",
      [tenantId, id, outcome.status, outcome.error, at]
    );
  }

  public async cancel(tenantId: string, id: string, from: ReadonlyArray<ScheduledMessageStatus>, at: Date): Promise<boolean> {
    const { rowCount } = await this.sql.query(
      "update scheduled_messages set status = 'cancelled', finished_at = $4 where tenant_id = $1 and id = $2 and status = any($3::text[])",
      [tenantId, id, [...from], at]
    );
    return rowCount > 0;
  }

  public async lastInboundAt(tenantId: string, conversationId: string): Promise<string | null> {
    const { rows } = await this.sql.query<{ at: Date | string | null }>(
      "select max(created_at) as at from conversation_messages where tenant_id = $1 and conversation_id = $2 and direction = 'inbound'",
      [tenantId, conversationId]
    );
    const at = rows[0]?.at;
    return at ? toIso(at) : null;
  }
}
