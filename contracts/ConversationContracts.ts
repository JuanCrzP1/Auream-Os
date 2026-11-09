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
 *   sent       salió por WhatsApp
 *   failed     no se pudo enviar (ver `error`)
 */
export type MessageStatus = "received" | "sent" | "failed";

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
  readonly createdAt: string;
}

export type ConversationFilter = "all" | "unread" | "bot_paused";

export interface ConversationListResponse {
  readonly conversations: ReadonlyArray<ConversationSummary>;
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
/** Cada cuánto consulta la bandeja si hay mensajes nuevos. */
export const CONVERSATIONS_POLL_INTERVAL_MS = 4_000;
