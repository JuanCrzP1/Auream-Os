import type { ConversationFilter, ConversationMessage, ConversationSummary } from "../../../contracts/ConversationContracts";
import type { Conversation, StoredMessage } from "../domain/Conversation";

/** Posición en la bandeja: la última actividad del chat y su id (orden estable al paginar). */
export interface InboxCursor {
  readonly activityAt: string;
  readonly id: string;
}

export interface InboxQuery {
  readonly filter: ConversationFilter;
  readonly search?: string;
  readonly connectionId?: string;
  /** Cliente con al menos una de estas etiquetas. */
  readonly labelIds?: ReadonlyArray<string>;
  /** Último mensaje desde (incluido) / hasta (excluido). */
  readonly from?: string;
  readonly to?: string;
  /** Chats después de este (los más recientes van primero). */
  readonly after?: InboxCursor;
  readonly limit: number;
}

export interface ConversationRepository {
  /** El chat de ese cliente en ese número; si no existe, se crea. */
  findOrCreate(tenantId: string, connectionId: string, phone: string, contactId: string | null): Promise<Conversation>;
  findById(tenantId: string, id: string): Promise<Conversation | null>;
  /** El chat de ese cliente en ese número, sin crearlo. */
  findByPhone(tenantId: string, connectionId: string, phone: string): Promise<Conversation | null>;
  /** Guarda el mensaje y actualiza el chat (último mensaje y no leídos) en una sola operación. */
  append(message: StoredMessage): Promise<void>;
  setBotEnabled(tenantId: string, id: string, enabled: boolean): Promise<void>;
  markRead(tenantId: string, id: string): Promise<void>;
  /**
   * La bandeja: chats con su número, contacto, etiquetas, último mensaje y
   * flujo en curso, del más reciente al más antiguo (por último mensaje).
   */
  inbox(tenantId: string, query: InboxQuery): Promise<ConversationSummary[]>;
  summary(tenantId: string, id: string): Promise<ConversationSummary | null>;
  /** Mensajes del hilo, del más nuevo hacia atrás (`before` = id del más antiguo ya visto). */
  messages(tenantId: string, conversationId: string, options: { readonly before?: string; readonly limit: number }): Promise<{ messages: ConversationMessage[]; hasMore: boolean }>;
}
