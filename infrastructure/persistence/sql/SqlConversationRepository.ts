import { randomUUID } from "node:crypto";
import type { ConversationLabel, ConversationMessage, ConversationSummary, MessageAuthor } from "../../../contracts/ConversationContracts";
import type { ConversationRepository, InboxQuery } from "../../../domains/conversations/application/ConversationRepository";
import { previewOf, type Conversation, type StoredMessage } from "../../../domains/conversations/domain/Conversation";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Conversaciones en PostgreSQL (`016_conversations.sql`). Todo filtra por
// cuenta. La bandeja se arma con una consulta: chat + número + contacto +
// etiquetas del contacto + flujo en curso (sesión viva de esa conversación).
// Orden y páginas por la última actividad del chat y su id
// (`017_conversations_activity_index.sql`).
// ---------------------------------------------------------------------------

interface ConversationRow {
  id: string;
  tenant_id: string;
  connection_id: string;
  contact_id: string | null;
  phone: string;
  bot_enabled: boolean;
  unread_count: number;
  created_at: Date | string;
}

interface InboxRow extends ConversationRow {
  connection_name: string;
  contact_name: string | null;
  last_message_text: string;
  last_message_author: MessageAuthor | null;
  last_message_at: Date | string | null;
  active_flow_name: string | null;
  labels: ConversationLabel[] | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  direction: ConversationMessage["direction"];
  author: MessageAuthor;
  kind: ConversationMessage["kind"];
  text: string;
  media_url: string | null;
  media_type: string | null;
  options: string[];
  status: ConversationMessage["status"];
  error: string | null;
  flow_name: string | null;
  agent_name: string | null;
  created_at: Date | string;
}

const toConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  tenantId: row.tenant_id,
  connectionId: row.connection_id,
  contactId: row.contact_id,
  phone: row.phone,
  botEnabled: row.bot_enabled,
  unreadCount: row.unread_count,
  createdAt: toIso(row.created_at)
});

const toSummary = (row: InboxRow): ConversationSummary => ({
  id: row.id,
  connectionId: row.connection_id,
  connectionName: row.connection_name,
  contactId: row.contact_id,
  contactName: row.contact_name,
  phone: row.phone,
  botEnabled: row.bot_enabled,
  unreadCount: row.unread_count,
  lastMessageText: row.last_message_text,
  lastMessageAuthor: row.last_message_author,
  lastMessageAt: row.last_message_at === null ? null : toIso(row.last_message_at),
  activeFlowName: row.active_flow_name,
  labels: row.labels ?? [],
  createdAt: toIso(row.created_at)
});

const CONVERSATION_COLUMNS = "id, tenant_id, connection_id, contact_id, phone, bot_enabled, unread_count, created_at";

/** Última actividad del chat: su último mensaje o, si aún no tiene, su creación. Igual que el índice. */
const ACTIVITY = "coalesce(c.last_message_at, c.created_at)";

/** Chat + número + contacto + etiquetas + flujo en curso. Los filtros extra usan parámetros desde $2 ($1 = cuenta). */
const INBOX_SELECT = `
  select c.id, c.tenant_id, c.connection_id, c.contact_id, c.phone, c.bot_enabled, c.unread_count, c.created_at,
         c.last_message_text, c.last_message_author, c.last_message_at,
         w.name as connection_name, ct.name as contact_name, a.name as active_flow_name,
         (select json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color) order by lower(l.name))
            from contact_label_assignments la
            join contact_labels l on l.tenant_id = la.tenant_id and l.id = la.label_id
           where la.tenant_id = c.tenant_id and la.contact_id = c.contact_id) as labels
    from conversations c
    join whatsapp_connections w on w.id = c.connection_id
    left join contacts ct on ct.id = c.contact_id
    left join flow_sessions s
      on s.id = c.tenant_id::text || ':' || c.connection_id::text || ':' || c.phone
     and s.status in ('active', 'waiting_input', 'delayed', 'paused')
    left join automations a on a.tenant_id = c.tenant_id and a.id::text = s.flow_id
   where c.tenant_id = $1`;

export class SqlConversationRepository implements ConversationRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async findOrCreate(tenantId: string, connectionId: string, phone: string, contactId: string | null): Promise<Conversation> {
    const result = await this.sql.query<ConversationRow>(
      `insert into conversations (id, tenant_id, connection_id, contact_id, phone)
       values ($1, $2, $3, $4, $5)
       on conflict (connection_id, phone) do update set contact_id = coalesce(conversations.contact_id, excluded.contact_id)
       where conversations.tenant_id = excluded.tenant_id
       returning ${CONVERSATION_COLUMNS}`,
      [randomUUID(), tenantId, connectionId, contactId, phone]
    );
    return toConversation(result.rows[0]!);
  }

  public async findById(tenantId: string, id: string): Promise<Conversation | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<ConversationRow>(`select ${CONVERSATION_COLUMNS} from conversations where tenant_id = $1 and id = $2`, [tenantId, id]);
    return result.rows[0] ? toConversation(result.rows[0]) : null;
  }

  public async append(message: StoredMessage): Promise<void> {
    await this.sql.transaction(async (tx) => {
      await tx.query(
        `insert into conversation_messages
           (id, tenant_id, conversation_id, direction, author, kind, text, media_url, media_type, options, status, error,
            flow_key, agent_id, agent_name, provider_message_id, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          message.id, message.tenantId, message.conversationId, message.direction, message.author, message.kind, message.text.slice(0, 8000),
          message.mediaUrl, message.mediaType, [...message.options], message.status, message.error, message.flowKey, message.agentId,
          message.agentName, message.providerMessageId, message.createdAt
        ]
      );
      // Las reacciones no cambian el último mensaje del chat.
      if (message.kind === "reaction") return;
      await tx.query(
        `update conversations
            set last_message_text = $3, last_message_author = $4,
                last_message_at = greatest(coalesce(last_message_at, $5::timestamptz), $5::timestamptz),
                unread_count = unread_count + $6, updated_at = now()
          where tenant_id = $1 and id = $2`,
        [message.tenantId, message.conversationId, previewOf(message), message.author, message.createdAt, message.direction === "inbound" ? 1 : 0]
      );
    });
  }

  public async setBotEnabled(tenantId: string, id: string, enabled: boolean): Promise<void> {
    await this.sql.query("update conversations set bot_enabled = $3, updated_at = now() where tenant_id = $1 and id = $2", [tenantId, id, enabled]);
  }

  public async markRead(tenantId: string, id: string): Promise<void> {
    await this.sql.query("update conversations set unread_count = 0 where tenant_id = $1 and id = $2 and unread_count > 0", [tenantId, id]);
  }

  public async inbox(tenantId: string, query: InboxQuery): Promise<ConversationSummary[]> {
    if (!isUuid(tenantId)) return [];
    const params: unknown[] = [tenantId];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const where: string[] = [];
    if (query.filter === "unread") where.push("c.unread_count > 0");
    if (query.filter === "bot_active") where.push("c.bot_enabled = true");
    if (query.filter === "bot_paused") where.push("c.bot_enabled = false");
    if (query.connectionId) {
      // Un número que no es un id no coincide con ningún chat.
      if (!isUuid(query.connectionId)) return [];
      where.push(`c.connection_id = ${param(query.connectionId)}`);
    }
    if (query.labelIds?.length) {
      const labelIds = query.labelIds.filter(isUuid);
      if (labelIds.length === 0) return [];
      where.push(
        `exists (select 1 from contact_label_assignments fl
                  where fl.tenant_id = c.tenant_id and fl.contact_id = c.contact_id and fl.label_id = any(${param(labelIds)}::uuid[]))`
      );
    }
    if (query.from) where.push(`${ACTIVITY} >= ${param(query.from)}::timestamptz`);
    if (query.to) where.push(`${ACTIVITY} < ${param(query.to)}::timestamptz`);
    if (query.search) {
      const pattern = param(`%${query.search.replace(/[%_\\]/g, (char) => `\\${char}`)}%`);
      where.push(`(c.phone ilike ${pattern} or ct.name ilike ${pattern})`);
    }
    if (query.after) {
      if (!isUuid(query.after.id)) return [];
      where.push(`(${ACTIVITY}, c.id) < (${param(query.after.activityAt)}::timestamptz, ${param(query.after.id)}::uuid)`);
    }
    const limit = param(query.limit);
    const result = await this.sql.query<InboxRow>(
      `${INBOX_SELECT}${where.map((clause) => ` and ${clause}`).join("")}
       order by ${ACTIVITY} desc, c.id desc
       limit ${limit}`,
      params
    );
    return result.rows.map(toSummary);
  }

  public async summary(tenantId: string, id: string): Promise<ConversationSummary | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<InboxRow>(`${INBOX_SELECT} and c.id = $2`, [tenantId, id]);
    return result.rows[0] ? toSummary(result.rows[0]) : null;
  }

  public async messages(tenantId: string, conversationId: string, options: { readonly before?: string; readonly limit: number }) {
    const params: unknown[] = [tenantId, conversationId, options.limit + 1];
    let cursor = "";
    if (options.before && isUuid(options.before)) {
      params.push(options.before);
      cursor = " and (m.created_at, m.id) < (select created_at, id from conversation_messages where id = $4 and conversation_id = $2)";
    }
    const result = await this.sql.query<MessageRow>(
      `select m.id, m.conversation_id, m.direction, m.author, m.kind, m.text, m.media_url, m.media_type, m.options, m.status, m.error,
              m.agent_name, m.created_at, a.name as flow_name
         from conversation_messages m
         left join automations a on a.tenant_id = m.tenant_id and a.key = m.flow_key
        where m.tenant_id = $1 and m.conversation_id = $2${cursor}
        order by m.created_at desc, m.id desc
        limit $3`,
      params
    );
    const hasMore = result.rows.length > options.limit;
    const messages = result.rows.slice(0, options.limit).reverse().map((row): ConversationMessage => ({
      id: row.id,
      conversationId: row.conversation_id,
      direction: row.direction,
      author: row.author,
      kind: row.kind,
      text: row.text,
      mediaUrl: row.media_url,
      mediaType: row.media_type,
      options: row.options,
      status: row.status,
      error: row.error,
      flowName: row.flow_name,
      agentName: row.agent_name,
      createdAt: toIso(row.created_at)
    }));
    return { messages, hasMore };
  }
}
