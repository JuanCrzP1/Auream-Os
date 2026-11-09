import type {
  ConversationMessageKind,
  MessageAuthor,
  MessageDirection,
  MessageStatus
} from "../../../contracts/ConversationContracts";

/** Un chat: un cliente (teléfono) en un número de la cuenta. */
export interface Conversation {
  readonly id: string;
  readonly tenantId: string;
  readonly connectionId: string;
  readonly contactId: string | null;
  readonly phone: string;
  readonly botEnabled: boolean;
  readonly unreadCount: number;
  readonly createdAt: string;
}

/** Un mensaje del hilo, tal como se guarda. */
export interface StoredMessage {
  readonly id: string;
  readonly tenantId: string;
  readonly conversationId: string;
  readonly direction: MessageDirection;
  readonly author: MessageAuthor;
  readonly kind: ConversationMessageKind;
  readonly text: string;
  readonly mediaUrl: string | null;
  readonly mediaType: string | null;
  readonly options: ReadonlyArray<string>;
  readonly status: MessageStatus;
  readonly error: string | null;
  readonly flowKey: string | null;
  readonly agentId: string | null;
  readonly agentName: string | null;
  readonly providerMessageId: string | null;
  readonly createdAt: string;
}

/** Texto que resume un mensaje en la lista de la bandeja. */
export function previewOf(message: Pick<StoredMessage, "kind" | "text">): string {
  const text = message.text.trim();
  if (text) return text.slice(0, 160);
  const labels: Partial<Record<ConversationMessageKind, string>> = {
    image: "📷 Foto",
    video: "🎥 Video",
    audio: "🎤 Audio",
    document: "📄 Documento",
    sticker: "Sticker",
    location: "📍 Ubicación",
    contact: "👤 Contacto",
    reaction: "Reacción"
  };
  return labels[message.kind] ?? "Mensaje";
}
