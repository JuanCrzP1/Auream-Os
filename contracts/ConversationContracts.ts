// ---------------------------------------------------------------------------
// Conversaciones (la bandeja): un chat por cliente y por número de la cuenta,
// con todos sus mensajes —del cliente, del bot y de los asesores—. Contrato
// compartido por la API y la web.
// ---------------------------------------------------------------------------

/** Quién escribió el mensaje. */
export type MessageAuthor = "contact" | "bot" | "agent";
export type MessageDirection = "inbound" | "outbound";
/**
 *   received   llegó del cliente
 *   sent       salió por WhatsApp (un chulo gris)
 *   delivered  llegó al celular del cliente (dos chulos grises)
 *   read       el cliente lo leyó (dos chulos azules)
 *   failed     no se pudo enviar (ver `error`)
 *
 * Un mensaje solo avanza (enviado → entregado → leído), nunca retrocede.
 */
export type MessageStatus = "received" | "sent" | "delivered" | "read" | "failed";

/** Lo que avisa WhatsApp de un mensaje enviado. */
export type DeliveryStatus = "sent" | "delivered" | "read";

/** Orden de avance de un mensaje enviado (los avisos llegan desordenados). */
export const DELIVERY_RANK: Readonly<Record<DeliveryStatus, number>> = { sent: 1, delivered: 2, read: 3 };

export type ConversationMessageKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "button_reply"
  | "list_reply"
  | "menu"
  | "reaction"
  | "other";

export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly direction: MessageDirection;
  readonly author: MessageAuthor;
  readonly kind: ConversationMessageKind;
  /** Texto, leyenda o título del botón elegido. */
  readonly text: string;
  readonly mediaUrl: string | null;
  readonly mediaType: string | null;
  /** Opciones de un menú enviado (para pintarlo como botones). */
  readonly options: ReadonlyArray<string>;
  readonly status: MessageStatus;
  readonly error: string | null;
  /** Flujo que lo envió (mensajes del bot). */
  readonly flowName: string | null;
  /** Asesor que lo envió. */
  readonly agentName: string | null;
  readonly createdAt: string;
}

/** Etiqueta del cliente del chat (catálogo de Contactos: la misma que ponen los flujos). */
export interface ConversationLabel {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface ConversationSummary {
  readonly id: string;
  readonly connectionId: string;
  readonly connectionName: string;
  readonly contactId: string | null;
  readonly contactName: string | null;
  /** Teléfono del cliente, solo dígitos. */
  readonly phone: string;
  /** El bot (flujos y disparadores) atiende este chat. */
  readonly botEnabled: boolean;
  readonly unreadCount: number;
  readonly lastMessageText: string;
  readonly lastMessageAuthor: MessageAuthor | null;
  readonly lastMessageAt: string | null;
  /** Flujo en curso del cliente, si está dentro de uno. */
  readonly activeFlowName: string | null;
  /** Etiquetas del cliente (vacío si el chat no tiene contacto). */
  readonly labels: ReadonlyArray<ConversationLabel>;
  /**
   * El número de WhatsApp de este chat fue eliminado: el historial se
   * conserva y se puede leer y etiquetar, pero ya no se puede responder,
   * ejecutar flujos ni activar el bot.
   */
  readonly connectionDeleted: boolean;
  readonly createdAt: string;
}

/**
 *   all          todos
 *   unread       con mensajes sin leer
 *   bot_active   los atiende el bot
 *   bot_paused   los atiende un asesor (bot pausado)
 */
export type ConversationFilter = "all" | "unread" | "bot_active" | "bot_paused";
export const CONVERSATION_FILTERS: ReadonlyArray<ConversationFilter> = ["all", "unread", "bot_active", "bot_paused"];

/**
 * Filtros de la bandeja (query string de `GET /conversations`).
 * `from`/`to` acotan la fecha del último mensaje (ISO; `to` excluido): la web
 * los calcula en la zona horaria de quien mira («hoy», «últimos 7 días»…).
 */
export interface ConversationListQuery {
  readonly filter?: ConversationFilter;
  readonly search?: string;
  readonly connectionId?: string;
  /** Chats cuyo cliente tenga AL MENOS UNA de estas etiquetas. */
  readonly labelIds?: ReadonlyArray<string>;
  readonly from?: string;
  readonly to?: string;
  /** `nextCursor` de la página anterior. */
  readonly cursor?: string;
}

export interface ConversationListResponse {
  readonly conversations: ReadonlyArray<ConversationSummary>;
  /** Hay más chats: pedirlos con `cursor`. */
  readonly nextCursor: string | null;
}

export interface SetConversationLabelsRequest {
  readonly labelIds: ReadonlyArray<string>;
}

export interface ConversationMessagesResponse {
  readonly messages: ReadonlyArray<ConversationMessage>;
  /** Hay mensajes más antiguos (pedir con `before`). */
  readonly hasMore: boolean;
}

export interface SendAgentMessageRequest {
  readonly text: string;
}

export interface UpdateConversationRequest {
  readonly botEnabled?: boolean;
}

export interface StartFlowRequest {
  /** Flujo a enviar (`automations.id`). */
  readonly automationId: string;
}

export const MAX_AGENT_MESSAGE_LENGTH = 4096;
/** Chats por página de la bandeja. */
export const CONVERSATIONS_PAGE_SIZE = 50;
/** Etiquetas por las que se puede filtrar a la vez. */
export const MAX_LABEL_FILTERS = 20;
/** Cada cuánto consulta la bandeja si hay mensajes nuevos. */
export const CONVERSATIONS_POLL_INTERVAL_MS = 4_000;

/**
 * Un chat abierto, en vivo: lo nuevo o cambiado desde `since` (el `cursor` de
 * la respuesta anterior). Sin `since`, la última página del hilo.
 */
export interface ConversationLiveResponse {
  readonly conversation: ConversationSummary;
  readonly messages: ReadonlyArray<ConversationMessage>;
  /** Hay mensajes más antiguos (solo en la primera carga). */
  readonly hasMore: boolean;
  /** Para la próxima consulta (`since`). */
  readonly cursor: string;
}

/** Cada cuánto se consulta un chat abierto con actividad reciente, y en calma. */
export const LIVE_POLL_ACTIVE_MS = 1_500;
export const LIVE_POLL_IDLE_MS = 4_000;
/** Cuánto dura la «actividad reciente» tras un cambio (un flujo enviando, un aviso de leído…). */
export const LIVE_ACTIVE_WINDOW_MS = 60_000;
