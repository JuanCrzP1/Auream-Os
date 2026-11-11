// ---------------------------------------------------------------------------
// Respuestas rápidas (Conversaciones): mensajes guardados de la cuenta que el
// asesor pone en el chat sin copiar y pegar. Cada una tiene un atajo
// («saludo», se busca escribiendo «/saludo») y una o varias piezas en orden:
// textos y archivos (foto, video, audio o documento). Contrato compartido por
// la API y la web.
// ---------------------------------------------------------------------------

import type { MediaKind } from "./MediaContracts";

export interface QuickReplyMedia {
  readonly type: MediaKind;
  /** URL pública del archivo (subido a la cuenta con `/media`). */
  readonly url: string;
  /** Nombre con que lo ve el cliente (documentos). */
  readonly fileName?: string;
}

/**
 * Una pieza: un texto o un archivo (con leyenda opcional). En los textos,
 * `{nombre}` se cambia por el primer nombre del cliente al usarla.
 */
export type QuickReplyPiece =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "media"; readonly media: QuickReplyMedia; readonly caption?: string };

export interface QuickReply {
  readonly id: string;
  readonly shortcut: string;
  readonly pieces: ReadonlyArray<QuickReplyPiece>;
  /** Veces que el equipo la usó (las más usadas salen primero). */
  readonly useCount: number;
  readonly lastUsedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuickReplyListResponse {
  readonly quickReplies: ReadonlyArray<QuickReply>;
  /** Quien mira puede crear, editar y borrar (`conversations.write`). */
  readonly canWrite: boolean;
}

export interface SaveQuickReplyRequest {
  readonly shortcut: string;
  readonly pieces: ReadonlyArray<QuickReplyPiece>;
}

/** Minúsculas, números, espacios, guiones y guiones bajos (como en Leona). */
export const QUICK_REPLY_SHORTCUT = /^[a-z0-9_-][a-z0-9 _-]{0,39}$/;
export const MAX_QUICK_REPLY_PIECES = 10;
export const MAX_QUICK_REPLY_TEXT = 4096;
export const MAX_QUICK_REPLIES = 500;

/** El atajo como se guarda: «Saludo Inicial » → «saludo inicial». */
export function normalizeShortcut(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/^[#/]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
