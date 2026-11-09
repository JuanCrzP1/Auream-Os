import { randomUUID } from "node:crypto";
import type { ConversationLabel, ConversationMessage, ConversationSummary, MessageAuthor } from "../../../contracts/ConversationContracts";
import type { ConversationRepository, InboxQuery } from "../../../domains/conversations/application/ConversationRepository";
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
  /** Etiquetas de cada contacto (en SQL vienen de Contactos). */
  public readonly contactLabels = new Map<string, ConversationLabel[]>();

  public async findOrCreate(tenantId: string, connectionId: string, phone: string, contactId: string | null): Promise<Conversation> {
    const existing = [...this.rows.values()].find((row) => row.connectionId === connectionId && row.phone === phone);
    if (existing) return existing;
    const row: Row = {
      id: randomUUID(), tenantId, connectionId, contactId, phone, botEnabled: true, unreadCount: 0,
      createdAt: new Date().toISOString(), lastMessageText: "", lastMessageAuthor: null, lastMessageAt: null
    };
    this.rows.set(row.id, row);
    return row;
  }

  public async findById(tenantId: string, id: string): Promise<Conversation | null> {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? row : null;
  }

  public async append(message: StoredMessage): Promise<void> {
    this.stored.push(message);
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

  private labelsOf(row: Row): ConversationLabel[] {
    return row.contactId ? (this.contactLabels.get(row.contactId) ?? []) : [];
  }

  private toSummary(row: Row): ConversationSummary {
    return {
      id: row.id, connectionId: row.connectionId, connectionName: "", contactId: row.contactId, contactName: null, phone: row.phone,
      botEnabled: row.botEnabled, unreadCount: row.unreadCount, lastMessageText: row.lastMessageText, lastMessageAuthor: row.lastMessageAuthor,
      lastMessageAt: row.lastMessageAt, activeFlowName: null, labels: this.labelsOf(row), createdAt: row.createdAt
    };
  }
}
