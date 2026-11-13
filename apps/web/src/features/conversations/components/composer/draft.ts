import type { AgentMedia, AgentMessagePart } from "@contracts/ConversationContracts";
import { fillQuickReplyName, type QuickReply } from "@contracts/QuickReplyContracts";
import { fillBusinessData } from "@contracts/BusinessDataContracts";
import type { ContactFieldValue } from "@contracts/ContactContracts";

// ---------------------------------------------------------------------------
// El borrador del compositor: piezas en espera (archivos adjuntos o piezas de
// una respuesta rápida) más el texto que se está escribiendo. Al enviar, todo
// sale en orden: primero las piezas, al final el texto.
// ---------------------------------------------------------------------------

export type DraftPiece =
  | { readonly id: string; readonly kind: "text"; readonly text: string }
  | { readonly id: string; readonly kind: "media"; readonly media: AgentMedia; readonly caption?: string; readonly label: string }
  | { readonly id: string; readonly kind: "uploading"; readonly label: string; readonly progress: number };

let sequence = 0;
export const pieceId = () => `piece-${Date.now().toString(36)}-${(sequence += 1)}`;

/** `{nombre}` con el primer nombre del cliente (la misma regla que el MCP, en `contracts`). */
export const fillVariables = fillQuickReplyName;

/** El tipo de archivo de WhatsApp según el archivo elegido. */
export function mediaKindOf(file: File): AgentMedia["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

export const MEDIA_LABEL: Readonly<Record<AgentMedia["type"], string>> = { image: "Foto", video: "Video", audio: "Audio", file: "Documento" };

/**
 * Una respuesta rápida en el compositor. Si es un solo texto, va al cuadro de
 * texto (se puede retocar antes de enviar); si tiene varias piezas o
 * archivos, quedan en espera, en orden.
 */
export function applyQuickReply(
  reply: QuickReply,
  contactName: string | null,
  /** Los Datos del negocio (`{g_horario}`): salen puestos, igual que desde el MCP. */
  business: Readonly<Record<string, ContactFieldValue>> = {}
): { readonly text?: string; readonly pieces: DraftPiece[] } {
  const fill = (text: string) => fillBusinessData(fillVariables(text, contactName), business);
  const only = reply.pieces.length === 1 ? reply.pieces[0] : undefined;
  if (only?.kind === "text") return { text: fill(only.text), pieces: [] };
  return {
    pieces: reply.pieces.map((piece): DraftPiece =>
      piece.kind === "text"
        ? { id: pieceId(), kind: "text", text: fill(piece.text) }
        : {
            id: pieceId(),
            kind: "media",
            media: piece.media,
            ...(piece.caption ? { caption: fill(piece.caption) } : {}),
            label: piece.media.fileName ?? MEDIA_LABEL[piece.media.type]
          }
    )
  };
}

/** Lo que se envía: las piezas listas y, al final, el texto escrito. */
export function toParts(pieces: ReadonlyArray<DraftPiece>, text: string): AgentMessagePart[] {
  const parts: AgentMessagePart[] = [];
  for (const piece of pieces) {
    if (piece.kind === "text") parts.push({ kind: "text", text: piece.text });
    if (piece.kind === "media") parts.push({ kind: "media", media: piece.media, ...(piece.caption ? { caption: piece.caption } : {}) });
  }
  if (text.trim()) parts.push({ kind: "text", text: text.trim() });
  return parts;
}
