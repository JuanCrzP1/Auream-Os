// ---------------------------------------------------------------------------
// Medios (imágenes, videos, audios y documentos) — contratos compartidos por
// la API y el frontend.
//
// Los bytes NO pasan por la API: el navegador los sube directo al almacén
// (Vercel Blob en la nube; una carpeta local en desarrollo) con un permiso de
// subida de un solo uso que da el servidor, y luego el servidor comprueba lo
// subido y lo registra en la cuenta. Los bloques guardan la URL pública.
// ---------------------------------------------------------------------------

export type MediaKind = "image" | "video" | "audio" | "file";
export const MEDIA_KINDS: ReadonlyArray<MediaKind> = ["image", "video", "audio", "file"];

export interface MediaRule {
  /** Tamaño máximo en bytes: el de WhatsApp para ese tipo. */
  readonly maxBytes: number;
  /** Tipos MIME que WhatsApp entrega para ese tipo. */
  readonly contentTypes: ReadonlyArray<string>;
}

const MB = 1024 * 1024;

/** Límites de la API de WhatsApp Business: lo que se sube es lo que se puede enviar. */
export const MEDIA_RULES: Readonly<Record<MediaKind, MediaRule>> = {
  image: { maxBytes: 5 * MB, contentTypes: ["image/jpeg", "image/png"] },
  video: { maxBytes: 16 * MB, contentTypes: ["video/mp4", "video/3gpp"] },
  audio: { maxBytes: 16 * MB, contentTypes: ["audio/aac", "audio/amr", "audio/mpeg", "audio/mp4", "audio/ogg"] },
  file: {
    maxBytes: 100 * MB,
    contentTypes: [
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ]
  }
};

const ALIASES: Readonly<Record<string, string>> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "audio/mp3": "audio/mpeg",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-aac": "audio/aac",
  "audio/opus": "audio/ogg"
};

const BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  mp4: "video/mp4", "3gp": "video/3gpp",
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", opus: "audio/ogg", amr: "audio/amr",
  pdf: "application/pdf", txt: "text/plain",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};

/**
 * Tipo MIME canónico de un archivo del navegador: los navegadores no siempre
 * lo informan, o usan variantes (`image/jpg`, `audio/x-m4a`).
 */
export function normalizeMediaContentType(declared: string, fileName: string): string {
  const type = declared.toLowerCase().split(";")[0]!.trim();
  if (type) return ALIASES[type] ?? type;
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  return BY_EXTENSION[extension] ?? "";
}

/** Para el selector de archivos del navegador. */
export function acceptAttribute(kind: MediaKind): string {
  return MEDIA_RULES[kind].contentTypes.join(",");
}

/** Pedir permiso para subir un archivo. */
export interface MediaUploadRequest {
  readonly kind: MediaKind;
  readonly fileName: string;
  readonly contentType: string;
  readonly size: number;
}

/**
 * Cómo subir los bytes:
 *   vercel-blob  con el SDK de Vercel Blob y este token de un solo uso
 *   direct       PUT del archivo a `uploadUrl` (almacén local de desarrollo)
 */
export type MediaUploadTicket =
  | { readonly strategy: "vercel-blob"; readonly pathname: string; readonly token: string; readonly expiresAt: string }
  | { readonly strategy: "direct"; readonly pathname: string; readonly uploadUrl: string; readonly expiresAt: string };

/** Confirmar una subida terminada para registrarla en la cuenta. */
export interface RegisterMediaRequest {
  readonly kind: MediaKind;
  readonly pathname: string;
  readonly fileName: string;
}

export interface MediaAssetSummary {
  readonly id: string;
  readonly kind: MediaKind;
  /** URL pública y estable: la que guardan los bloques y la que recibe WhatsApp. */
  readonly url: string;
  readonly contentType: string;
  readonly size: number;
  readonly fileName: string;
  readonly createdAt: string;
}
