import type { MediaKind } from "../../../contracts/MediaContracts";
import {
  MAX_QUICK_REPLY_PIECES,
  MAX_QUICK_REPLY_TEXT,
  QUICK_REPLY_SHORTCUT,
  normalizeShortcut,
  type QuickReplyPiece
} from "../../../contracts/QuickReplyContracts";

// ---------------------------------------------------------------------------
// Una respuesta rápida bien formada: atajo válido y de una a diez piezas
// (textos no vacíos; archivos con enlace https y su tipo). Puro: dice qué
// está mal en vez de lanzar, y la aplicación lo convierte en error.
// ---------------------------------------------------------------------------

const MEDIA_KINDS: ReadonlyArray<MediaKind> = ["image", "video", "audio", "file"];

export type Checked<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: string };

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

export function checkShortcut(value: unknown): Checked<string> {
  const shortcut = typeof value === "string" ? normalizeShortcut(value) : "";
  if (!shortcut) return { ok: false, problem: "Escribe el atajo (por ejemplo «saludo»)." };
  if (!QUICK_REPLY_SHORTCUT.test(shortcut)) return { ok: false, problem: "El atajo admite hasta 40 letras minúsculas, números, espacios, guiones y guiones bajos." };
  return { ok: true, value: shortcut };
}

function checkPiece(value: unknown, position: number): Checked<QuickReplyPiece> {
  const piece = record(value);
  const label = `La pieza ${position}`;
  if (piece["kind"] === "text") {
    const text = typeof piece["text"] === "string" ? piece["text"].trim() : "";
    if (!text) return { ok: false, problem: `${label} está vacía: escribe el texto o quítala.` };
    if (text.length > MAX_QUICK_REPLY_TEXT) return { ok: false, problem: `${label} admite hasta ${MAX_QUICK_REPLY_TEXT} caracteres.` };
    return { ok: true, value: { kind: "text", text } };
  }
  if (piece["kind"] === "media") {
    const media = record(piece["media"]);
    const type = media["type"];
    const url = typeof media["url"] === "string" ? media["url"].trim() : "";
    if (typeof type !== "string" || !(MEDIA_KINDS as ReadonlyArray<string>).includes(type)) return { ok: false, problem: `${label} no tiene un tipo de archivo válido.` };
    if (!/^https:\/\/\S+$/i.test(url) || url.length > 2048) return { ok: false, problem: `${label} no tiene archivo: súbelo de nuevo.` };
    const fileName = typeof media["fileName"] === "string" ? media["fileName"].trim().slice(0, 200) : "";
    const caption = typeof piece["caption"] === "string" ? piece["caption"].trim() : "";
    if (caption.length > MAX_QUICK_REPLY_TEXT) return { ok: false, problem: `La leyenda de la pieza ${position} es muy larga.` };
    return {
      ok: true,
      value: { kind: "media", media: { type: type as MediaKind, url, ...(fileName ? { fileName } : {}) }, ...(caption ? { caption } : {}) }
    };
  }
  return { ok: false, problem: `${label} no es válida.` };
}

export function checkPieces(value: unknown): Checked<ReadonlyArray<QuickReplyPiece>> {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, problem: "Agrega al menos un texto o un archivo." };
  if (value.length > MAX_QUICK_REPLY_PIECES) return { ok: false, problem: `Una respuesta rápida admite hasta ${MAX_QUICK_REPLY_PIECES} piezas.` };
  const pieces: QuickReplyPiece[] = [];
  for (const [index, raw] of value.entries()) {
    const checked = checkPiece(raw, index + 1);
    if (!checked.ok) return checked;
    pieces.push(checked.value);
  }
  return { ok: true, value: pieces };
}
