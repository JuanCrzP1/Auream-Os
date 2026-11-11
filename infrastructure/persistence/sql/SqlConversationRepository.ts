import { randomUUID } from "node:crypto";
import type { ConversationSummary, DeliveryStatus } from "../../../contracts/ConversationContracts";
import type { ConversationRepository, InboxQuery } from "../../../domains/conversations/application/ConversationRepository";
import type { Conversation, StoredMessage } from "../../../domains/conversations/domain/Conversation";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";
import { SqlConversationThread } from "./SqlConversationThread";
import { SqlConversationInbox } from "./SqlConversationInbox";

// ---------------------------------------------------------------------------
// Conversaciones en PostgreSQL (`016_conversations.sql`). Todo filtra por
// cuenta. La bandeja se arma con una consulta: chat + número + contacto +
// etiquetas del contacto + flujo en curso (sesión viva de esa conversación).
// Orden y páginas por la última actividad del chat y su id
// (`017_conversations_activity_index.sql`). El hilo de mensajes de cada chat
// vive en `SqlConversationThread`.
// ---------------------------------------------------------------------------

interface ConversationRow {
  id: string;
  tenant_id: string;
  connection_id: string;
  contact_id: string | null;
  phone: string;
  bot_enabled: boolean;
  unread_count: number;
  /** Solo en lecturas que cruzan con el número (no en el alta). */
  connection_deleted?: boolean;
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
  connectionDeleted: row.connection_deleted ?? false,
  createdAt: toIso(row.created_at)
});

const CONVERSATION_COLUMNS = "id, tenant_id, connection_id, contact_id, phone, bot_enabled, unread_count, created_at";

export class SqlConversationRepository implements ConversationRepository {
  /** El hilo de mensajes de cada chat (guardar, páginas, en vivo, entregado/leído). */
  private readonly thread: SqlConversationThread;
  /** La bandeja (lista con filtros y resumen de un chat). */
  private readonly inboxQuery: SqlConversationInbox;

  public constructor(private readonly sql: SqlClient) {
    this.thread = new SqlConversationThread(sql);
    this.inboxQuery = new SqlConversationInbox(sql);
  }

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
    const result = await this.sql.query<ConversationRow>(
      `select c.id, c.tenant_id, c.connection_id, c.contact_id, c.phone, c.bot_enabled, c.unread_count, c.created_at,
              w.deleted_at is not null as connection_deleted
         from conversations c
         join whatsapp_connections w on w.id = c.connection_id
        where c.tenant_id = $1 and c.id = $2`,
      [tenantId, id]
    );
    return result.rows[0] ? toConversation(result.rows[0]) : null;
  }

  public async findByPhone(tenantId: string, connectionId: string, phone: string): Promise<Conversation | null> {
    if (!isUuid(tenantId) || !isUuid(connectionId)) return null;
    const result = await this.sql.query<ConversationRow>(
      `select c.id, c.tenant_id, c.connection_id, c.contact_id, c.phone, c.bot_enabled, c.unread_count, c.created_at,
              w.deleted_at is not null as connection_deleted
         from conversations c
         join whatsapp_connections w on w.id = c.connection_id
        where c.tenant_id = $1 and c.connection_id = $2 and c.phone = $3`,
      [tenantId, connectionId, phone]
    );
    return result.rows[0] ? toConversation(result.rows[0]) : null;
  }

  public append(message: StoredMessage): Promise<void> {
    return this.thread.append(message);
  }

  public async setBotEnabled(tenantId: string, id: string, enabled: boolean): Promise<void> {
    await this.sql.query("update conversations set bot_enabled = $3, updated_at = now() where tenant_id = $1 and id = $2", [tenantId, id, enabled]);
  }

  public async markRead(tenantId: string, id: string): Promise<void> {
    await this.sql.query("update conversations set unread_count = 0 where tenant_id = $1 and id = $2 and unread_count > 0", [tenantId, id]);
  }

  public inbox(tenantId: string, query: InboxQuery): Promise<ConversationSummary[]> {
    return this.inboxQuery.inbox(tenantId, query);
  }

  public summary(tenantId: string, id: string): Promise<ConversationSummary | null> {
    return this.inboxQuery.summary(tenantId, id);
  }

  public messages(tenantId: string, conversationId: string, options: { readonly before?: string; readonly limit: number }) {
    return this.thread.messages(tenantId, conversationId, options);
  }

  public changesSince(tenantId: string, conversationId: string, since: string) {
    return this.thread.changesSince(tenantId, conversationId, since);
  }

  public liveCursor(tenantId: string, conversationId: string) {
    return this.thread.liveCursor(tenantId, conversationId);
  }

  public findMessage(tenantId: string, conversationId: string, messageId: string) {
    return this.thread.findMessage(tenantId, conversationId, messageId);
  }

  /** Sus mensajes se borran con él (`on delete cascade`). */
  public async remove(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(tenantId) || !isUuid(id)) return false;
    const result = await this.sql.query("delete from conversations where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rowCount > 0;
  }

  public markDelivery(tenantId: string, connectionId: string, providerMessageIds: ReadonlyArray<string>, status: DeliveryStatus) {
    return this.thread.markDelivery(tenantId, connectionId, providerMessageIds, status);
  }
}
