import type { ConversationLabel, ConversationSummary, MessageAuthor } from "../../../contracts/ConversationContracts";
import type { InboxQuery } from "../../../domains/conversations/application/ConversationRepository";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// La bandeja en PostgreSQL: chats con su número, contacto, etiquetas, último
// mensaje y flujo en curso, con filtros y páginas por la última actividad
// (`017_conversations_activity_index.sql`).
// ---------------------------------------------------------------------------

interface InboxRow {
  id: string;
  tenant_id: string;
  connection_id: string;
  contact_id: string | null;
  phone: string;
  bot_enabled: boolean;
  unread_count: number;
  connection_deleted?: boolean;
  created_at: Date | string;
  connection_name: string;
  contact_name: string | null;
  contact_avatar_url: string | null;
  last_message_text: string;
  last_message_author: MessageAuthor | null;
  last_message_at: Date | string | null;
  active_flow_name: string | null;
  labels: ConversationLabel[] | null;
}

const toSummary = (row: InboxRow): ConversationSummary => ({
  id: row.id,
  connectionId: row.connection_id,
  connectionName: row.connection_name,
  contactId: row.contact_id,
  contactName: row.contact_name,
  contactAvatarUrl: row.contact_avatar_url,
  phone: row.phone,
  botEnabled: row.bot_enabled,
  unreadCount: row.unread_count,
  lastMessageText: row.last_message_text,
  lastMessageAuthor: row.last_message_author,
  lastMessageAt: row.last_message_at === null ? null : toIso(row.last_message_at),
  activeFlowName: row.active_flow_name,
  labels: row.labels ?? [],
  connectionDeleted: row.connection_deleted ?? false,
  createdAt: toIso(row.created_at)
});

/** Última actividad del chat: su último mensaje o, si aún no tiene, su creación. Igual que el índice. */
const ACTIVITY = "coalesce(c.last_message_at, c.created_at)";

/** Chat + número + contacto + etiquetas + flujo en curso. Los filtros extra usan parámetros desde $2 ($1 = cuenta). */
const INBOX_SELECT = `
  select c.id, c.tenant_id, c.connection_id, c.contact_id, c.phone, c.bot_enabled, c.unread_count, c.created_at,
         c.last_message_text, c.last_message_author, c.last_message_at,
         w.name as connection_name, w.deleted_at is not null as connection_deleted, ct.name as contact_name, ct.avatar_url as contact_avatar_url, a.name as active_flow_name,
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

export class SqlConversationInbox {
  public constructor(private readonly sql: SqlClient) {}

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
}
