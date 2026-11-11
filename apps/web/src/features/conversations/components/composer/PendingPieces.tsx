import type { ConversationMessage } from "@contracts/ConversationContracts";
import { QuotedMessage } from "../QuotedMessage";
import type { DraftPiece } from "./draft";

const ICON: Readonly<Record<string, string>> = { image: "📷", video: "🎥", audio: "🎤", file: "📄" };

/** Encima del cuadro de texto: el mensaje que se cita y lo que saldrá antes del texto. */
export function PendingPieces({
  replyTo,
  pieces,
  onCancelReply,
  onRemove
}: {
  readonly replyTo: ConversationMessage | null;
  readonly pieces: ReadonlyArray<DraftPiece>;
  readonly onCancelReply: () => void;
  readonly onRemove: (id: string) => void;
}) {
  if (!replyTo && pieces.length === 0) return null;
  return (
    <div className="chat-pending">
      {replyTo ? (
        <div className="chat-pending__reply">
          <QuotedMessage quote={{ id: replyTo.id, author: replyTo.author, kind: replyTo.kind, text: replyTo.text }} />
          <button type="button" className="chat-pending__x" aria-label="No citar" onClick={onCancelReply}>✕</button>
        </div>
      ) : null}
      {pieces.length > 0 ? (
        <ul className="chat-pending__list" aria-label="Se enviará también">
          {pieces.map((piece) => (
            <li key={piece.id} className={`chat-chip${piece.kind === "uploading" ? " is-uploading" : ""}`}>
              <span aria-hidden="true">{piece.kind === "text" ? "💬" : piece.kind === "media" ? ICON[piece.media.type] : "⏳"}</span>
              <span className="chat-chip__label">
                {piece.kind === "text" ? piece.text : piece.kind === "media" && piece.caption ? `${piece.label} · ${piece.caption}` : piece.label}
              </span>
              {piece.kind === "uploading" ? <span className="chat-chip__progress">{piece.progress} %</span> : null}
              <button type="button" className="chat-pending__x" aria-label={`Quitar ${piece.kind === "text" ? "texto" : piece.label}`} disabled={piece.kind === "uploading"} onClick={() => onRemove(piece.id)}>✕</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
