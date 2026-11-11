import "./message-actions.css";
import type { MessageQuote } from "@contracts/ConversationContracts";

const KIND_LABEL: Readonly<Record<string, string>> = { image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", document: "📄 Documento", sticker: "Sticker", location: "📍 Ubicación", contact: "👤 Contacto" };
const AUTHOR: Readonly<Record<MessageQuote["author"], string>> = { contact: "Cliente", bot: "Bot", agent: "Asesor" };

/** El mensaje citado (dentro de la burbuja o encima del compositor), como en WhatsApp. */
export function QuotedMessage({ quote }: { readonly quote: MessageQuote }) {
  const text = quote.text.trim() || KIND_LABEL[quote.kind] || "Mensaje";
  return (
    <span className={`chat-quote chat-quote--${quote.author}`}>
      <strong>{AUTHOR[quote.author]}</strong>
      <span>{text}</span>
    </span>
  );
}
