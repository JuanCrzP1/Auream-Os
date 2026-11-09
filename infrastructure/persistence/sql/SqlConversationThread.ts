import type { ConversationMessage, DeliveryStatus, MessageAuthor } from "../../../contracts/ConversationContracts";
import type { DeliveryMarkOutcome } from "../../../domains/conversations/application/ConversationRepository";
import { previewOf, type StoredMessage } from "../../../domains/conversations/domain/Conversation";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// El hilo de un chat en PostgreSQL (`016_conversations.sql`, `020_conversation_live.sql`):
//
//   append         guarda un mensaje y pone al día el chat (último mensaje, no leídos)
//   messages       páginas del hilo, del más nuevo hacia atrás
//   changesSince   lo nuevo o cambiado desde una marca (la pantalla en vivo)
//   markDelivery   entregado / leído por el id de WhatsApp (solo avanza)
//
// La marca (`cursor`) es `updated_at` con toda su precisión, como texto: la
// pantalla la devuelve tal cual. Se consulta con un pequeño solape para no
// perder escrituras que confirman un poco tarde; la pantalla une por id.
// ---------------------------------------------------------------------------

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

const toMessage = (row: MessageRow): ConversationMessage => ({
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
});

/** Columnas de un mensaje del hilo (con el nombre del flujo que lo envió). */
const MESSAGE_COLUMNS = `m.id, m.conversation_id, m.direction, m.author, m.kind, m.text, m.media_url, m.media_type, m.options, m.status, m.error,
       m.agent_name, m.created_at, a.name as flow_name`;
const MESSAGE_FROM = `from conversation_messages m
  left join automations a on a.tenant_id = m.tenant_id and a.key = m.flow_key`;

/** Solape de «lo que cambió desde…». */
const LIVE_OVERLAP = "interval '5 seconds'";
/** Tope de cambios por consulta (la pantalla vuelve a pedir enseguida). */
const LIVE_LIMIT = 200;

export class SqlConversationThread {
  public constructor(private readonly sql: SqlClient) {}

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

  public async messages(tenantId: string, conversationId: string, options: { readonly before?: string; readonly limit: number }) {
    const params: unknown[] = [tenantId, conversationId, options.limit + 1];
    let cursor = "";
    if (options.before && isUuid(options.before)) {
      params.push(options.before);
      cursor = " and (m.created_at, m.id) < (select created_at, id from conversation_messages where id = $4 and conversation_id = $2)";
    }
    const result = await this.sql.query<MessageRow>(
      `select ${MESSAGE_COLUMNS} ${MESSAGE_FROM}
        where m.tenant_id = $1 and m.conversation_id = $2${cursor}
        order by m.created_at desc, m.id desc
        limit $3`,
      params
    );
    const hasMore = result.rows.length > options.limit;
    return { messages: result.rows.slice(0, options.limit).reverse().map(toMessage), hasMore };
  }

  public async changesSince(tenantId: string, conversationId: string, since: string): Promise<{ messages: ConversationMessage[]; cursor: string }> {
    if (!isUuid(tenantId) || !isUuid(conversationId)) return { messages: [], cursor: since };
    const [changes, cursor] = await Promise.all([
      this.sql.query<MessageRow>(
        `select ${MESSAGE_COLUMNS} ${MESSAGE_FROM}
          where m.tenant_id = $1 and m.conversation_id = $2 and m.updated_at > $3::timestamptz - ${LIVE_OVERLAP}
          order by m.created_at, m.id
          limit ${LIVE_LIMIT}`,
        [tenantId, conversationId, since]
      ),
      this.liveCursor(tenantId, conversationId)
    ]);
    return { messages: changes.rows.map(toMessage), cursor };
  }

  /** La marca actual del chat (la última escritura); `now()` si aún no hay mensajes. */
  public async liveCursor(tenantId: string, conversationId: string): Promise<string> {
    if (!isUuid(tenantId) || !isUuid(conversationId)) return new Date().toISOString();
    const result = await this.sql.query<{ cursor: string }>(
      "select coalesce(max(updated_at), now())::text as cursor from conversation_messages where tenant_id = $1 and conversation_id = $2",
      [tenantId, conversationId]
    );
    return result.rows[0]!.cursor;
  }

  /**
   * Entregado o leído, por el id de WhatsApp. Solo avanza (los avisos llegan
   * desordenados). Dice cuántos de esos mensajes había y cuántos avanzaron.
   */
  public async markDelivery(tenantId: string, connectionId: string, providerMessageIds: ReadonlyArray<string>, status: DeliveryStatus): Promise<DeliveryMarkOutcome> {
    if (!isUuid(tenantId) || !isUuid(connectionId) || providerMessageIds.length === 0) return { matched: 0, advanced: 0 };
    const rank = (value: string) => `(case ${value} when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 99 end)`;
    const result = await this.sql.query<{ matched: number; advanced: number }>(
      `with target as (
         select m.id, m.status
           from conversation_messages m
           join conversations c on c.id = m.conversation_id
          where c.tenant_id = $1 and c.connection_id = $2
            and m.direction = 'outbound' and m.provider_message_id = any($3::text[])
       ), moved as (
         update conversation_messages m
            set status = $4, updated_at = now()
           from target t
          where m.id = t.id and ${rank("t.status")} < ${rank("$4::text")}
         returning m.id
       )
       select (select count(*) from target)::int as matched, (select count(*) from moved)::int as advanced`,
      [tenantId, connectionId, [...providerMessageIds], status]
    );
    return result.rows[0] ?? { matched: 0, advanced: 0 };
  }
}
