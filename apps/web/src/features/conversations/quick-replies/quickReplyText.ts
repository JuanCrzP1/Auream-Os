import { UNCATEGORIZED, normalizeShortcut, type QuickReply, type QuickReplyPiece } from "@contracts/QuickReplyContracts";

// ---------------------------------------------------------------------------
// Las respuestas rápidas como se muestran (en el chat y en Configuración):
// el resumen de cada pieza, la búsqueda y los grupos por categoría.
// ---------------------------------------------------------------------------

const LABEL: Readonly<Record<string, string>> = { image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", file: "📄 Documento" };

/** Resumen de una pieza para la lista. */
export function pieceSummary(piece: QuickReplyPiece): string {
  return piece.kind === "text" ? piece.text : `${LABEL[piece.media.type] ?? "Archivo"}${piece.caption ? ` · ${piece.caption}` : ""}`;
}

/** Las que coinciden con lo buscado: primero por atajo (empieza por), luego por categoría o contenido. Sin tildes ni mayúsculas. */
export function matchQuickReplies(replies: ReadonlyArray<QuickReply>, query: string): QuickReply[] {
  const needle = normalizeShortcut(query);
  if (!needle) return [...replies];
  const starts = replies.filter((reply) => reply.shortcut.startsWith(needle));
  const contains = replies.filter(
    (reply) =>
      !reply.shortcut.startsWith(needle) &&
      (reply.shortcut.includes(needle) ||
        normalizeShortcut(reply.category ?? "").includes(needle) ||
        reply.pieces.some((piece) => normalizeShortcut(pieceSummary(piece)).includes(needle)))
  );
  return [...starts, ...contains];
}

export interface QuickReplyGroup {
  readonly category: string;
  readonly replies: ReadonlyArray<QuickReply>;
}

/** Por categoría (en orden alfabético; «Sin categoría» al final), respetando el orden de cada lista. */
export function groupByCategory(replies: ReadonlyArray<QuickReply>): QuickReplyGroup[] {
  const groups = new Map<string, QuickReply[]>();
  for (const reply of replies) {
    const category = reply.category ?? UNCATEGORIZED;
    groups.set(category, [...(groups.get(category) ?? []), reply]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b, "es")))
    .map(([category, list]) => ({ category, replies: list }));
}

/** Las categorías que ya usa la cuenta (para sugerirlas al escribir). */
export function categoriesOf(replies: ReadonlyArray<QuickReply>): string[] {
  return [...new Set(replies.map((reply) => reply.category).filter((category): category is string => Boolean(category)))].sort((a, b) => a.localeCompare(b, "es"));
}

/** Un atajo libre para la copia: «saludo» → «saludo-copia», «saludo-copia-2»… */
export function copyShortcut(shortcut: string, taken: ReadonlyArray<string>): string {
  const base = `${shortcut}-copia`.slice(0, 34);
  if (!taken.includes(base)) return base;
  let index = 2;
  while (taken.includes(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
