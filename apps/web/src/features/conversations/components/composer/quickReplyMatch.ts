import type { QuickReply, QuickReplyPiece } from "@contracts/QuickReplyContracts";
import { normalizeShortcut } from "@contracts/QuickReplyContracts";

const LABEL: Readonly<Record<string, string>> = { image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", file: "📄 Documento" };

/** Resumen de una pieza para la lista. */
export function pieceSummary(piece: QuickReplyPiece): string {
  return piece.kind === "text" ? piece.text : `${LABEL[piece.media.type] ?? "Archivo"}${piece.caption ? ` · ${piece.caption}` : ""}`;
}

/** Las que coinciden con lo buscado: primero por atajo (empieza por), luego por contenido. */
export function matchQuickReplies(replies: ReadonlyArray<QuickReply>, query: string): QuickReply[] {
  const needle = normalizeShortcut(query);
  if (!needle) return [...replies];
  const starts = replies.filter((reply) => reply.shortcut.startsWith(needle));
  const contains = replies.filter(
    (reply) => !reply.shortcut.startsWith(needle) && (reply.shortcut.includes(needle) || reply.pieces.some((piece) => normalizeShortcut(pieceSummary(piece)).includes(needle)))
  );
  return [...starts, ...contains];
}
