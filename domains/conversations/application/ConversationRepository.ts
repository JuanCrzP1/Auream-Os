import type { ConversationFilter, ConversationMessage, ConversationStatus, ConversationSummary, DeliveryStatus } from "../../../contracts/ConversationContracts";
import type { Conversation, StoredMessage } from "../domain/Conversation";

/** Posición en la bandeja: la última actividad del chat y su id (orden estable al paginar). */
export interface InboxCursor {
  readonly activityAt: string;
  readonly id: string;
}

export interface InboxQuery {
  readonly filter: ConversationFilter;
  /** Pestaña (ausente: todas). */
  readonly status?: ConversationStatus;
  /** Responsable: un asesor o `null` (sin asignar). Ausente: cualquiera. */
  readonly assigneeId?: string | null;
  /** Quien mira (para «Mis chats»). */
  readonly viewerId?: string;
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

/** Lo que hace falta de un mensaje del hilo para citarlo o reaccionarle. */
export interface MessageRef {
  readonly id: string;
  readonly kind: ConversationMessage["kind"];
  /** Id de WhatsApp: sin él, WhatsApp no sabe a qué mensaje se refiere. */
  readonly providerMessageId: string | null;
}

/** Un aviso de entregado/leído: cuántos de sus mensajes había y cuántos avanzaron. */
export interface DeliveryMarkOutcome {
  readonly matched: number;
  readonly advanced: number;
}

export interface ConversationRepository {
  /** El chat de ese cliente en ese número; si no existe, se crea. */
  findOrCreate(tenantId: string, connectionId: string, phone: string, contactId: string | null): Promise<Conversation>;
  findById(tenantId: string, id: string): Promise<Conversation | null>;
  /** El chat de ese cliente en ese número, sin crearlo. */
  findByPhone(tenantId: string, connectionId: string, phone: string): Promise<Conversation | null>;
  /** Guarda el mensaje y actualiza el chat (último mensaje y no leídos) en una sola operación. */
  append(message: StoredMessage): Promise<void>;
  /** Activa o pausa el bot; el estado sigue (`statusForBot`). */
  setBotEnabled(tenantId: string, id: string, enabled: boolean): Promise<void>;
  /**
   * Un asesor responde: pausa el bot y, si el chat no tenía responsable, lo
   * deja a su nombre (`agentId` null: alguien sin cuenta, p. ej. un agente
   * de IA por MCP, que solo lo pausa).
   */
  claim(tenantId: string, id: string, agentId: string | null): Promise<void>;
  /** Pasa el chat a un asesor o lo deja sin asignar; el bot queda en pausa. */
  assign(tenantId: string, id: string, assigneeId: string | null): Promise<void>;
  /** Lo cierra: resuelto, el bot vuelve a atender y nada queda pendiente. */
  resolve(tenantId: string, id: string): Promise<void>;
  /** Cuántos chats hay en cada estado. */
  counts(tenantId: string): Promise<Record<ConversationStatus, number>>;
  markRead(tenantId: string, id: string): Promise<void>;
  /**
   * La bandeja: chats con su número, contacto, etiquetas, último mensaje y
   * flujo en curso, del más reciente al más antiguo (por último mensaje).
   */
  inbox(tenantId: string, query: InboxQuery): Promise<ConversationSummary[]>;
  summary(tenantId: string, id: string): Promise<ConversationSummary | null>;
  /**
   * En vivo: mensajes nuevos o cambiados (p. ej. entregado/leído) desde la
   * marca `since`, más la marca nueva. Opaca para quien la usa.
   */
  changesSince(tenantId: string, conversationId: string, since: string): Promise<{ messages: ConversationMessage[]; cursor: string }>;
  /** La marca actual del hilo (para empezar a pedir cambios). */
  liveCursor(tenantId: string, conversationId: string): Promise<string>;
  /**
   * Entregado/leído de lo que salió por ese número, por el id de WhatsApp.
   * Solo avanza. Dice cuántos de esos mensajes encontró y cuántos avanzaron.
   */
  markDelivery(tenantId: string, connectionId: string, providerMessageIds: ReadonlyArray<string>, status: DeliveryStatus): Promise<DeliveryMarkOutcome>;
  /** Un mensaje de ese chat (para citarlo o reaccionarle); `null` si no es de ese chat. */
  findMessage(tenantId: string, conversationId: string, messageId: string): Promise<MessageRef | null>;
  /** Borra el chat y todo su historial (el contacto sigue en Contactos). Dice si existía. */
  remove(tenantId: string, id: string): Promise<boolean>;
  /** Mensajes del hilo, del más nuevo hacia atrás (`before` = id del más antiguo ya visto). */
  messages(tenantId: string, conversationId: string, options: { readonly before?: string; readonly limit: number }): Promise<{ messages: ConversationMessage[]; hasMore: boolean }>;
}
