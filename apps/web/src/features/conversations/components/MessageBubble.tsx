import type { ConversationMessage } from "@contracts/ConversationContracts";
import { messageTime } from "./chatTime";
import { AlertGlyph, DocGlyph, SentGlyph } from "./ChatGlyphs";

// ---------------------------------------------------------------------------
// Un mensaje del hilo como en WhatsApp iOS: el cliente a la izquierda, lo que
// sale (bot o asesor) a la derecha, con hora y visto de enviado (la colita va
// en el último de cada tanda); los menús enviados con
// sus botones; las fotos y archivos con su vista previa. Un envío fallido lo
// dice con su motivo.
// ---------------------------------------------------------------------------

function Media({ message }: { readonly message: ConversationMessage }) {
  if (!message.mediaUrl) {
    return message.kind === "text" || message.kind === "button_reply" || message.kind === "list_reply" || message.kind === "menu" ? null : (
      <span className="ios-bubble__media-missing">{message.kind === "image" ? "📷 Foto" : message.kind === "audio" ? "🎤 Audio" : message.kind === "video" ? "🎥 Video" : "📄 Archivo"}</span>
    );
  }
  if (message.kind === "image" || message.kind === "sticker") {
    return (
      <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="ios-bubble__image">
        <img src={message.mediaUrl} alt={message.text || "Foto"} loading="lazy" />
      </a>
    );
  }
  if (message.kind === "video") return <video className="ios-bubble__video" src={message.mediaUrl} controls preload="metadata" />;
  if (message.kind === "audio") return <audio className="ios-bubble__audio" src={message.mediaUrl} controls preload="none" />;
  return (
    <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="ios-bubble__doc">
      <DocGlyph />
      <span>Abrir archivo</span>
    </a>
  );
}

export function MessageBubble({ message, tail = true }: { readonly message: ConversationMessage; readonly tail?: boolean }) {
  if (message.kind === "reaction") {
    return <p className={`ios-reaction ios-reaction--${message.direction}`} aria-label={`Reacción ${message.text}`}>{message.text}</p>;
  }
  const outbound = message.direction === "outbound";
  const origin = message.author === "bot" ? (message.flowName ? `🤖 ${message.flowName}` : "🤖 Bot") : message.author === "agent" ? (message.agentName ?? "Asesor") : null;

  return (
    <div className={`ios-msg ios-msg--${message.direction}${tail && message.options.length === 0 ? " has-tail" : ""}`}>
      <div className={`ios-bubble ios-bubble--${message.direction}${message.status === "failed" ? " is-failed" : ""}`}>
        {origin ? <span className="ios-bubble__origin">{origin}</span> : null}
        <Media message={message} />
        {message.kind === "button_reply" || message.kind === "list_reply" ? <span className="ios-bubble__reply-tag">Eligió una opción</span> : null}
        {message.text ? <p className="ios-bubble__text">{message.text}</p> : null}
        <span className="ios-bubble__meta">
          {messageTime(message.createdAt)}
          {outbound && message.status === "sent" ? <span className="ios-sent" title="Enviado"><SentGlyph /></span> : null}
          {message.status === "failed" ? <AlertGlyph /> : null}
        </span>
      </div>
      {message.options.length > 0 ? (
        <div className="ios-options" aria-label="Opciones enviadas">
          {message.options.map((option) => (
            <span key={option} className="ios-option">{option}</span>
          ))}
        </div>
      ) : null}
      {message.status === "failed" ? <p className="ios-msg__error">No se envió: {message.error ?? "error del proveedor"}</p> : null}
    </div>
  );
}
