import { useCallback, useState } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { uploadMedia } from "@shared/media/uploadMedia";
import { MEDIA_LABEL, mediaKindOf, pieceId, type DraftPiece } from "./draft";

/**
 * Las piezas en espera del compositor: archivos que se suben al elegirlos
 * (con su avance) y piezas de una respuesta rápida. Se quitan una a una.
 */
export function useDraftPieces(onError: (message: string) => void) {
  const [pieces, setPieces] = useState<ReadonlyArray<DraftPiece>>([]);

  const replace = (id: string, next: DraftPiece | null) =>
    setPieces((current) => (next ? current.map((piece) => (piece.id === id ? next : piece)) : current.filter((piece) => piece.id !== id)));

  /** Sube un archivo y lo deja listo para enviar. Devuelve la pieza lista (o `null` si falló). */
  const attach = useCallback(async (file: File, options: { readonly voice?: boolean } = {}): Promise<DraftPiece | null> => {
    const id = pieceId();
    const type = mediaKindOf(file);
    const label = options.voice ? "Nota de voz" : file.name || MEDIA_LABEL[type];
    setPieces((current) => [...current, { id, kind: "uploading", label, progress: 0 }]);
    try {
      const asset = await uploadMedia(file, type, (progress) => replace(id, { id, kind: "uploading", label, progress }));
      const ready: DraftPiece = { id, kind: "media", label, media: { type, url: asset.url, fileName: asset.fileName, ...(options.voice ? { voice: true } : {}) } };
      replace(id, ready);
      return ready;
    } catch (error) {
      replace(id, null);
      onError(apiErrorMessage(error, `No se pudo subir «${label}».`));
      return null;
    }
  }, [onError]);

  const add = useCallback((next: ReadonlyArray<DraftPiece>) => setPieces((current) => [...current, ...next]), []);
  const remove = useCallback((id: string) => replace(id, null), []);
  const clear = useCallback(() => setPieces([]), []);

  return { pieces, attach, add, remove, clear, uploading: pieces.some((piece) => piece.kind === "uploading") };
}
