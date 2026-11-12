import "./editor.css";
import { useId, useState } from "react";
import type { MediaKind } from "@contracts/MediaContracts";
import { MAX_QUICK_REPLY_CATEGORY, MAX_QUICK_REPLY_PIECES, normalizeShortcut, type QuickReply, type QuickReplyPiece, type SaveQuickReplyRequest } from "@contracts/QuickReplyContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { QuickReplyPieceEditor, type EditablePiece } from "./QuickReplyPieceEditor";
import { QuickReplyPreview } from "./QuickReplyPreview";

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
 * Crear, editar o duplicar una respuesta rápida: atajo, categoría y piezas en
 * orden, con la vista previa de cómo la ve el cliente en WhatsApp.
 */
export function QuickReplyEditor({
  reply,
  initial,
  categories,
  onSave,
  onClose
}: {
  /** La que se edita; `null`: una nueva (vacía o copia de `initial`). */
  readonly reply: QuickReply | null;
  readonly initial?: SaveQuickReplyRequest;
  /** Categorías que ya usa la cuenta (sugerencias). */
  readonly categories: ReadonlyArray<string>;
  readonly onSave: (request: SaveQuickReplyRequest) => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const listId = useId();
  const start = reply ?? initial;
  const [shortcut, setShortcut] = useState(start?.shortcut ?? "");
  const [category, setCategory] = useState(start?.category ?? "");
  const [pieces, setPieces] = useState<EditablePiece[]>(() => (start ? start.pieces.map(toEditable) : [{ key: key(), kind: "text", text: "" }]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onSave({ shortcut: normalizeShortcut(shortcut), category: category.trim() || null, pieces: pieces.map(toPiece) });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar la respuesta rápida."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog qr-editor" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId}>{reply ? `Editar /${reply.shortcut}` : initial ? "Duplicar respuesta rápida" : "Nueva respuesta rápida"}</h2>
        <div className="qr-editor__layout">
          <div className="qr-editor__form">
            <div className="qr-editor__fields">
              <label className="qr-editor__field">
                <span>Atajo</span>
                <span className="qr-editor__shortcut">
                  <span aria-hidden="true">/</span>
                  <input className="ui-input" value={shortcut} maxLength={40} autoFocus={!reply} placeholder="saludo" onChange={(event) => setShortcut(event.target.value.toLowerCase())} />
                </span>
                <small>En el chat se busca escribiendo /{normalizeShortcut(shortcut) || "atajo"}.</small>
              </label>
              <label className="qr-editor__field">
                <span>Categoría</span>
                <input className="ui-input" value={category} list={listId} maxLength={MAX_QUICK_REPLY_CATEGORY} placeholder="Saludos, Precios, Pagos…" onChange={(event) => setCategory(event.target.value)} />
                <datalist id={listId}>
                  {categories.map((name) => <option key={name} value={name} />)}
                </datalist>
                <small>Opcional. Agrupa las respuestas en el chat.</small>
              </label>
            </div>
            <p className="qr-editor__tip">Se envían en orden, una burbuja por pieza. En los textos, <code>{"{nombre}"}</code> se cambia por el nombre del cliente.</p>
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
          </div>
          <QuickReplyPreview pieces={pieces} />
        </div>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={onClose}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={busy || pieces.length === 0} onClick={() => void save()}>{busy ? "Guardando…" : reply ? "Guardar cambios" : "Crear respuesta"}</button>
        </div>
      </div>
    </div>
  );
}
