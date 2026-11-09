import type { MessageItem } from "./types";
import { isUsableMediaUrl as isUsableUrl } from "@contracts/blocks/validation/message";

// ---------------------------------------------------------------------------
// Reglas sobre las fuentes de un medio (enlace o archivo del dispositivo),
// compartidas por la validación y el preview para que no puedan divergir.
// ---------------------------------------------------------------------------

/** Solo `http:`/`https:` cuentan como fuente (la misma regla que valida el bloque). */
export { isUsableMediaUrl as isUsableUrl } from "@contracts/blocks/validation/message";

/** ¿El archivo del bloque está subido (tiene su URL guardada)? */
export function isUploaded(item: MessageItem): boolean {
  return item.kind !== "text" && item.kind !== "interval" && Boolean(item.mediaId) && isUsableUrl(item.url);
}

/**
 * El bloque para una copia. Un archivo SUBIDO se conserva tal cual (su URL es
 * un dato y sirve igual a la copia). Uno sin subir no: sus bytes no existen
 * fuera de esta sesión y la copia diría tener un archivo que nadie encuentra.
 */
export function withoutLocalFile<T extends MessageItem>(item: T): T {
  if (item.kind === "text" || item.kind === "interval") return item;
  if (!item.fileName || isUploaded(item)) return item;

  return { ...item, fileName: "" };
}
