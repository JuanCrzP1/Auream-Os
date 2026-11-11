import "./quick-replies.css";
import { useId, useState } from "react";
import type { MediaKind } from "@contracts/MediaContracts";
import { MAX_QUICK_REPLY_PIECES, normalizeShortcut, type QuickReply, type QuickReplyPiece, type SaveQuickReplyRequest } from "@contracts/QuickReplyContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { QuickReplyPieceEditor, type EditablePiece } from "./QuickReplyPieceEditor";

let sequence = 0;
const key = () => `qr-${(sequence += 1)}`;

const toEditable = (piece: QuickReplyPiece): EditablePiece =>
  piece.kind === "text"
    ? { key: key(), kind: "text", text: piece.text }
    : { key: key(), kind: "media", type: piece.media.type, url: piece.media.url, fileName: piece.media.fileName ?? "", caption: piece.caption ?? "" };

const toPiece = (piece: EditablePiece): QuickReplyPiece =>
  piece.kind === "text"
    ? { kind: "text", text: piece.text }
    : { kind: "media", media: { type: piece.type, url: piece.url, ...(piece.fileName ? { fileName: piece.fileName } : {}) }, ...(piece.caption.trim() ? { caption: piece.caption } : {}) };

const ADD: ReadonlyArray<{ readonly kind: "text" | MediaKind; readonly label: string }> = [
  { kind: "text", label: "Texto" },
  { kind: "image", label: "Foto" },
  { kind: "video", label: "Video" },
  { kind: "audio", label: "Audio" },
  { kind: "file", label: "Documento" }
];

/**
 * Crear o editar una respuesta rápida: el atajo y sus piezas en orden (como
 * Leona). Desde aquí también se borra.
 */
export function QuickReplyEditor({
  reply,
  onSave,
  onDelete,
  onClose
}: {
  readonly reply: QuickReply | null;
  readonly onSave: (request: SaveQuickReplyRequest) => Promise<unknown>;
  readonly onDelete: () => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [shortcut, setShortcut] = useState(reply?.shortcut ?? "");
  const [pieces, setPieces] = useState<EditablePiece[]>(() => (reply ? reply.pieces.map(toEditable) : [{ key: key(), kind: "text", text: "" }]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const add = (kind: "text" | MediaKind) =>
    setPieces((current) => [...current, kind === "text" ? { key: key(), kind: "text", text: "" } : { key: key(), kind: "media", type: kind, url: "", fileName: "", caption: "" }]);
  const change = (index: number, piece: EditablePiece) => setPieces((current) => current.map((item, at) => (at === index ? piece : item)));
  const move = (index: number, delta: -1 | 1) =>
    setPieces((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({ shortcut: normalizeShortcut(shortcut), pieces: pieces.map(toPiece) });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar la respuesta rápida."));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
        <div className="ui-dialog qr-editor" onClick={(event) => event.stopPropagation()}>
          <h2 id={titleId}>{reply ? `Editar /${reply.shortcut}` : "Nueva respuesta rápida"}</h2>
          <p className="ui-muted">Escribe <strong>/{normalizeShortcut(shortcut) || "atajo"}</strong> en cualquier chat para usarla. En los textos, <code>{"{nombre}"}</code> se cambia por el nombre del cliente.</p>
          <label className="qr-editor__field">
            <span>Atajo</span>
            <span className="qr-editor__shortcut">
              <span aria-hidden="true">/</span>
              <input className="ui-input" value={shortcut} maxLength={40} autoFocus={!reply} placeholder="saludo" onChange={(event) => setShortcut(event.target.value.toLowerCase())} />
            </span>
          </label>
          <ol className="qr-editor__pieces">
            {pieces.map((piece, index) => (
              <QuickReplyPieceEditor
                key={piece.key}
                piece={piece}
                position={index + 1}
                total={pieces.length}
                onChange={(next) => change(index, next)}
                onMove={(delta) => move(index, delta)}
                onRemove={() => setPieces((current) => current.filter((_, at) => at !== index))}
              />
            ))}
          </ol>
          {pieces.length < MAX_QUICK_REPLY_PIECES ? (
            <div className="qr-editor__add" role="group" aria-label="Agregar pieza">
              <span>Agregar:</span>
              {ADD.map((option) => (
                <button key={option.kind} type="button" className="ui-btn ui-btn--ghost" onClick={() => add(option.kind)}>+ {option.label}</button>
              ))}
            </div>
          ) : null}
          {error ? <p className="ui-error" role="alert">{error}</p> : null}
          <div className="ui-dialog__footer qr-editor__footer">
            {reply ? <button type="button" className="ui-btn ui-btn--ghost qr-editor__delete" disabled={busy} onClick={() => setConfirmDelete(true)}>Borrar</button> : null}
            <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={onClose}>Cancelar</button>
            <button type="button" className="ui-btn ui-btn--primary" disabled={busy || pieces.length === 0} onClick={() => void save()}>{busy ? "Guardando…" : reply ? "Guardar" : "Crear respuesta"}</button>
          </div>
        </div>
      </div>
      {confirmDelete && reply ? (
        <ConfirmDialog
          title={`¿Borrar /${reply.shortcut}?`}
          message="Nadie del equipo podrá volver a usarla. Los mensajes ya enviados no cambian."
          confirmLabel="Borrar"
          onConfirm={async () => {
            await onDelete();
            onClose();
          }}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </>
  );
}
