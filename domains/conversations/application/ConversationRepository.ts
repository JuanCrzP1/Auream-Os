import type { ConversationFilter, ConversationMessage, ConversationSummary } from "../../../contracts/ConversationContracts";
import type { Conversation, StoredMessage } from "../domain/Conversation";

export interface InboxQuery {
  readonly filter: ConversationFilter;
  readonly search?: string;
  readonly connectionId?: string;
  readonly limit: number;
}

export interface ConversationRepository {
  /** El chat de ese cliente en ese número; si no existe, se crea. */
  findOrCreate(tenantId: string, connectionId: string, phone: string, contactId: string | null): Promise<Conversation>;
  findById(tenantId: string, id: string): Promise<Conversation | null>;
  /** Guarda el mensaje y actualiza el chat (último mensaje y no leídos) en una sola operación. */
  append(message: StoredMessage): Promise<void>;
  setBotEnabled(tenantId: string, id: string, enabled: boolean): Promise<void>;
  markRead(tenantId: string, id: string): Promise<void>;
  /** La bandeja: chats con su número, contacto, último mensaje y flujo en curso. */
  inbox(tenantId: string, query: InboxQuery): Promise<ConversationSummary[]>;
  summary(tenantId: string, id: string): Promise<ConversationSummary | null>;
  /** Mensajes del hilo, del más nuevo hacia atrás (`before` = id del más antiguo ya visto). */
  messages(tenantId: string, conversationId: string, options: { readonly before?: string; readonly limit: number }): Promise<{ messages: ConversationMessage[]; hasMore: boolean }>;
}
