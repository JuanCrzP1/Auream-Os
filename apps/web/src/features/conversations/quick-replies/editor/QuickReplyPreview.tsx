import { fillBusinessData } from "@contracts/BusinessDataContracts";
import { useBusinessValues } from "@shared/business-data/useBusinessData";
import type { EditablePiece } from "./QuickReplyPieceEditor";

const SAMPLE_NAME = "María";
const KIND_LABEL = { image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", file: "📄 Documento" } as const;

/**
 * Cómo la ve el cliente en WhatsApp: una burbuja por pieza, en orden, con
 * `{nombre}` cambiado por un nombre de ejemplo y los Datos del negocio
 * (`{g_…}`) con su valor real, como saldrán en el chat.
 */
export function QuickReplyPreview({ pieces }: { readonly pieces: ReadonlyArray<EditablePiece> }) {
  const business = useBusinessValues();
  const fill = (text: string) => fillBusinessData(text.replace(/\{\s*nombre\s*\}/gi, SAMPLE_NAME), business);
  const visible = pieces.filter((piece) => (piece.kind === "text" ? piece.text.trim() : true));
  return (
    <aside className="qr-preview" aria-label="Vista previa en WhatsApp">
      <span className="qr-preview__label">Así la ve el cliente</span>
      <div className="qr-preview__phone">
        {visible.length === 0 ? <p className="qr-preview__empty">Escribe un texto o agrega un archivo para verlo aquí.</p> : null}
        {visible.map((piece) => (
          <div key={piece.key} className="qr-preview__bubble">
            {piece.kind === "media" ? (
              piece.type === "image" && piece.url ? (
                <img src={piece.url} alt="" className="qr-preview__image" />
              ) : (
                <span className="qr-preview__file">{KIND_LABEL[piece.type]}{piece.fileName ? ` · ${piece.fileName}` : piece.url ? "" : " (sin subir)"}</span>
              )
            ) : null}
            {piece.kind === "text" ? <p>{fill(piece.text)}</p> : piece.caption.trim() ? <p>{fill(piece.caption)}</p> : null}
          </div>
        ))}
      </div>
      <small className="qr-preview__hint">{"{nombre}"} se ve como «{SAMPLE_NAME}»: en cada chat sale el nombre del cliente. Tus Datos del negocio salen con su valor: {"{g_horario}"}.</small>
    </aside>
  );
}
