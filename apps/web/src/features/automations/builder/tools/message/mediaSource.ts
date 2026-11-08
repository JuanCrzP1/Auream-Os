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

/**
 * El bloque sin su archivo local. Para copias: los bytes están indexados por el
 * id original y una copia que conservara `fileName` diría tener un archivo que
 * nadie puede encontrar. El enlace sí se conserva (es un dato).
 */
export function withoutLocalFile<T extends MessageItem>(item: T): T {
  if (item.kind === "text" || item.kind === "interval") return item;
  if (!item.fileName) return item;

  return { ...item, fileName: "" };
}
