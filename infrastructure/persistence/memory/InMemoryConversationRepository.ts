import { randomUUID } from "node:crypto";
import { DELIVERY_RANK, type ConversationLabel, type ConversationMessage, type ConversationSummary, type DeliveryStatus, type MessageAuthor } from "../../../contracts/ConversationContracts";
import type { ConversationRepository, DeliveryMarkOutcome, InboxQuery } from "../../../domains/conversations/application/ConversationRepository";
import { previewOf, type Conversation, type StoredMessage } from "../../../domains/conversations/domain/Conversation";

interface Row extends Conversation {
  lastMessageText: string;
  lastMessageAuthor: MessageAuthor | null;
  lastMessageAt: string | null;
}

const activity = (row: Row) => row.lastMessageAt ?? row.createdAt;

/** Conversaciones en memoria (tests). Mismas reglas que la versión SQL; sin nombres de número ni de flujo. */
export class InMemoryConversationRepository implements ConversationRepository {
  private readonly rows = new Map<string, Row>();
  public readonly stored: StoredMessage[] = [];
  /** Marca de cambio de cada mensaje (en SQL, `updated_at`): un contador que solo crece. */
  private readonly changed = new Map<string, number>();
  private tick = 0;
  /** Etiquetas de cada contacto (en SQL vienen de Contactos). */
  public readonly contactLabels = new Map<string, ConversationLabel[]>();
  /** Números eliminados (en SQL, `whatsapp_connections.deleted_at`). */
  public readonly deletedConnections = new Set<string>();

  public async findOrCreate(tenantId: string, connectionId: string, phone: string, contactId: string | null): Promise<Conversation> {
    const existing = [...this.rows.values()].find((row) => row.connectionId === connectionId && row.phone === phone);
    if (existing) return existing;
    const row: Row = {
      id: randomUUID(), tenantId, connectionId, contactId, phone, botEnabled: true, unreadCount: 0, connectionDeleted: false,
      createdAt: new Date().toISOString(), lastMessageText: "", lastMessageAuthor: null, lastMessageAt: null
    };
    this.rows.set(row.id, row);
    return row;
  }

  public async findById(tenantId: string, id: string): Promise<Conversation | null> {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? { ...row, connectionDeleted: this.deletedConnections.has(row.connectionId) } : null;
  }

  public async findByPhone(tenantId: string, connectionId: string, phone: string): Promise<Conversation | null> {
    const row = [...this.rows.values()].find((item) => item.tenantId === tenantId && item.connectionId === connectionId && item.phone === phone);
    return row ? { ...row, connectionDeleted: this.deletedConnections.has(row.connectionId) } : null;
  }

  public async append(message: StoredMessage): Promise<void> {
    this.stored.push(message);
    this.changed.set(message.id, ++this.tick);
    const row = this.rows.get(message.conversationId);
    if (!row || message.kind === "reaction") return;
    this.rows.set(row.id, {
      ...row,
      lastMessageText: previewOf(message),
      lastMessageAuthor: message.author,
      lastMessageAt: message.createdAt,
      unreadCount: row.unreadCount + (message.direction === "inbound" ? 1 : 0)
    });
  }

  public async setBotEnabled(tenantId: string, id: string, enabled: boolean): Promise<void> {
    const row = this.rows.get(id);
    if (row && row.tenantId === tenantId) this.rows.set(id, { ...row, botEnabled: enabled });
  }

  public async markRead(tenantId: string, id: string): Promise<void> {
    const row = this.rows.get(id);
    if (row && row.tenantId === tenantId) this.rows.set(id, { ...row, unreadCount: 0 });
  }

  public async inbox(tenantId: string, query: InboxQuery): Promise<ConversationSummary[]> {
    const after = query.after;
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId)
      .filter((row) => query.filter !== "unread" || row.unreadCount > 0)
      .filter((row) => query.filter !== "bot_active" || row.botEnabled)
      .filter((row) => query.filter !== "bot_paused" || !row.botEnabled)
      .filter((row) => !query.connectionId || row.connectionId === query.connectionId)
      .filter((row) => !query.labelIds?.length || this.labelsOf(row).some((label) => query.labelIds!.includes(label.id)))
      .filter((row) => !query.from || activity(row) >= query.from)
      .filter((row) => !query.to || activity(row) < query.to)
      .filter((row) => !query.search || row.phone.includes(query.search))
      .sort((a, b) => activity(b).localeCompare(activity(a)) || b.id.localeCompare(a.id))
      .filter((row) => !after || activity(row) < after.activityAt || (activity(row) === after.activityAt && row.id < after.id))
      .slice(0, query.limit)
      .map((row) => this.toSummary(row));
  }

  public async summary(tenantId: string, id: string): Promise<ConversationSummary | null> {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? this.toSummary(row) : null;
  }

  public async messages(tenantId: string, conversationId: string, options: { readonly before?: string; readonly limit: number }) {
    const all = this.stored.filter((message) => message.tenantId === tenantId && message.conversationId === conversationId);
    const end = options.before ? all.findIndex((message) => message.id === options.before) : all.length;
    const slice = all.slice(Math.max(0, end - options.limit), end);
    const messages = slice.map((message): ConversationMessage => ({
      id: message.id, conversationId: message.conversationId, direction: message.direction, author: message.author, kind: message.kind,
      text: message.text, mediaUrl: message.mediaUrl, mediaType: message.mediaType, options: message.options, status: message.status,
      error: message.error, flowName: message.flowKey, agentName: message.agentName, createdAt: message.createdAt
    }));
    return { messages, hasMore: end - options.limit > 0 };
  }

  public async changesSince(tenantId: string, conversationId: string, since: string) {
    const from = Number(since) || 0;
    const ids = new Set([...this.changed.entries()].filter(([, at]) => at > from).map(([id]) => id));
    const all = await this.messages(tenantId, conversationId, { limit: Number.MAX_SAFE_INTEGER });
    return { messages: all.messages.filter((message) => ids.has(message.id)), cursor: String(this.tick) };
  }

  public async liveCursor(): Promise<string> {
    return String(this.tick);
  }

  public async markDelivery(tenantId: string, connectionId: string, providerMessageIds: ReadonlyArray<string>, status: DeliveryStatus): Promise<DeliveryMarkOutcome> {
    let matched = 0;
    let advanced = 0;
    this.stored.forEach((message, index) => {
      const row = this.rows.get(message.conversationId);
      if (!row || row.tenantId !== tenantId || row.connectionId !== connectionId || message.direction !== "outbound") return;
      if (!message.providerMessageId || !providerMessageIds.includes(message.providerMessageId)) return;
      matched += 1;
      const current = DELIVERY_RANK[message.status as DeliveryStatus] ?? 99;
      if (current >= DELIVERY_RANK[status]) return;
      this.stored[index] = { ...message, status };
      this.changed.set(message.id, ++this.tick);
      advanced += 1;
    });
    return { matched, advanced };
  }

  private labelsOf(row: Row): ConversationLabel[] {
    return row.contactId ? (this.contactLabels.get(row.contactId) ?? []) : [];
  }

  private toSummary(row: Row): ConversationSummary {
    return {
      id: row.id, connectionId: row.connectionId, connectionName: "", contactId: row.contactId, contactName: null, phone: row.phone,
      botEnabled: row.botEnabled, unreadCount: row.unreadCount, lastMessageText: row.lastMessageText, lastMessageAuthor: row.lastMessageAuthor,
      lastMessageAt: row.lastMessageAt, activeFlowName: null, labels: this.labelsOf(row),
      connectionDeleted: this.deletedConnections.has(row.connectionId), createdAt: row.createdAt
    };
  }
}
