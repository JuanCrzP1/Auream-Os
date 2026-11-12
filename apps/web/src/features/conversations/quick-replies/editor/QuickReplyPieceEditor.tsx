import { useState } from "react";
import { acceptAttribute, type MediaKind } from "@contracts/MediaContracts";
import { MAX_QUICK_REPLY_TEXT } from "@contracts/QuickReplyContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { uploadMedia } from "@shared/media/uploadMedia";

/** Una pieza mientras se edita (un archivo puede estar aún sin subir). */
export type EditablePiece =
  | { readonly key: string; readonly kind: "text"; readonly text: string }
  | { readonly key: string; readonly kind: "media"; readonly type: MediaKind; readonly url: string; readonly fileName: string; readonly caption: string };

const KIND_NAME: Readonly<Record<MediaKind, string>> = { image: "Foto", video: "Video", audio: "Audio", file: "Documento" };

/** Una pieza de la respuesta: su texto, o su archivo (subirlo o cambiarlo) con leyenda. */
export function QuickReplyPieceEditor({
  piece,
  position,
  total,
  onChange,
  onMove,
  onRemove
}: {
  readonly piece: EditablePiece;
  readonly position: number;
  readonly total: number;
  readonly onChange: (piece: EditablePiece) => void;
  readonly onMove: (delta: -1 | 1) => void;
  readonly onRemove: () => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file || piece.kind !== "media") return;
    setError(null);
    setProgress(0);
    try {
      const asset = await uploadMedia(file, piece.type, (loaded) => setProgress(loaded));
      onChange({ ...piece, url: asset.url, fileName: asset.fileName });
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo subir el archivo."));
    } finally {
      setProgress(null);
    }
  };

  return (
    <li className="qr-piece">
      <div className="qr-piece__bar">
        <span className="qr-piece__tag">{position}. {piece.kind === "text" ? "Texto" : KIND_NAME[piece.type]}</span>
        <span className="qr-piece__tools">
          <button type="button" aria-label="Subir pieza" title="Subir" disabled={position === 1} onClick={() => onMove(-1)}>↑</button>
          <button type="button" aria-label="Bajar pieza" title="Bajar" disabled={position === total} onClick={() => onMove(1)}>↓</button>
          <button type="button" aria-label="Quitar pieza" title="Quitar" onClick={onRemove}>✕</button>
        </span>
      </div>
      {piece.kind === "text" ? (
        <textarea
          className="ui-input qr-piece__text"
          value={piece.text}
          rows={3}
          maxLength={MAX_QUICK_REPLY_TEXT}
          placeholder="Hola {nombre} 👋, gracias por escribirnos…"
          aria-label={`Texto de la pieza ${position}`}
          onChange={(event) => onChange({ ...piece, text: event.target.value })}
        />
      ) : (
        <>
          <label className="qr-piece__file">
            <input type="file" accept={acceptAttribute(piece.type)} onChange={(event) => void upload(event.target.files?.[0])} />
            <span>{progress !== null ? `Subiendo… ${progress} %` : piece.url ? `✓ ${piece.fileName || "Archivo listo"} · Cambiar` : `Elegir ${KIND_NAME[piece.type].toLowerCase()}`}</span>
          </label>
          {piece.type !== "audio" ? (
            <input className="ui-input" value={piece.caption} maxLength={MAX_QUICK_REPLY_TEXT} placeholder="Leyenda (opcional)" aria-label={`Leyenda de la pieza ${position}`} onChange={(event) => onChange({ ...piece, caption: event.target.value })} />
          ) : null}
          {error ? <p className="ui-error" role="alert">{error}</p> : null}
        </>
      )}
    </li>
  );
}
