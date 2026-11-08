import type { MessageItem } from "./types";

// ---------------------------------------------------------------------------
// Reglas sobre las fuentes de un medio (enlace o archivo del dispositivo),
// compartidas por la validación y el preview para que no puedan divergir.
// ---------------------------------------------------------------------------

/** Solo `http:`/`https:` cuentan como fuente. */
export function isUsableUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;

  try {
    const { protocol } = new URL(trimmed);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

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
