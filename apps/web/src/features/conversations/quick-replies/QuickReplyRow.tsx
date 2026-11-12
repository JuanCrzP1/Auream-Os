import type { QuickReply } from "@contracts/QuickReplyContracts";
import { pieceSummary } from "./quickReplyText";

const ICON: Readonly<Record<string, string>> = { image: "📷", video: "🎥", audio: "🎤", file: "📄" };

function usage(reply: QuickReply): string {
  if (reply.useCount === 0) return "Sin usar aún";
  return reply.useCount === 1 ? "Usada 1 vez" : `Usada ${reply.useCount} veces`;
}

/** Una respuesta rápida en Configuración: atajo, qué envía, cuánto se usa y sus acciones. */
export function QuickReplyRow({
  reply,
  canManage,
  onEdit,
  onDuplicate,
  onDelete
}: {
  readonly reply: QuickReply;
  readonly canManage: boolean;
  readonly onEdit: () => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}) {
  const first = reply.pieces[0];
  const files = reply.pieces.filter((piece) => piece.kind === "media");
  return (
    <li className="qr-row">
      <div className="qr-row__main">
        <span className="qr-row__shortcut">/{reply.shortcut}</span>
        <p className="qr-row__text">{first ? pieceSummary(first) : ""}</p>
        <span className="qr-row__meta">
          {reply.pieces.length > 1 ? <span>{reply.pieces.length} mensajes</span> : null}
          {files.length > 0 ? <span aria-label={`${files.length} archivo(s)`}>{files.map((piece) => (piece.kind === "media" ? ICON[piece.media.type] : "")).join(" ")}</span> : null}
          <span className={reply.useCount === 0 ? "is-unused" : ""}>{usage(reply)}</span>
        </span>
      </div>
      {canManage ? (
        <div className="qr-row__actions">
          <button type="button" className="qr-row__btn" onClick={onEdit} aria-label={`Editar /${reply.shortcut}`}>Editar</button>
          <button type="button" className="qr-row__btn" onClick={onDuplicate} aria-label={`Duplicar /${reply.shortcut}`}>Duplicar</button>
          <button type="button" className="qr-row__btn qr-row__btn--danger" onClick={onDelete} aria-label={`Borrar /${reply.shortcut}`}>Borrar</button>
        </div>
      ) : null}
    </li>
  );
}
