import type { AiConfig } from "../../../contracts/AiConfig";
import type { AiAttachment } from "../../ports/AiGateway";
import type { DocumentTextReader } from "../../ports/DocumentTextReader";
import type { MediaFetcher } from "../../ports/MediaFetcher";
import { detectDocumentType } from "../payment-proof/runPaymentProofStep";

// ---------------------------------------------------------------------------
// Lo que la IA ve u oye además del texto (casillas «Audios», «Imágenes» y
// «PDF» del bloque, como en Leona):
//
//   archivo del cliente → descargar → ¿qué es? → audio / foto: va al modelo
//                                              → PDF: se lee su texto aquí
//
// El archivo sale del mensaje que acaba de llegar, o del mensaje para la IA
// cuando es solo un enlace (lo que guardó «Esperar respuesta»: `{respuesta}`).
// ---------------------------------------------------------------------------

export interface AiMediaPorts {
  readonly fetcher: MediaFetcher;
  readonly reader: DocumentTextReader;
}

export type AiMediaKind = "audio" | "image" | "pdf";

export interface AiMediaInput {
  /** El mensaje para la IA, sin el enlace del archivo y con el texto del PDF. */
  readonly text: string;
  readonly attachments: ReadonlyArray<AiAttachment>;
  readonly kind?: AiMediaKind;
  /** Sin texto y sin archivo usable: por qué (va a la variable de error). */
  readonly failure?: string;
  readonly events: ReadonlyArray<string>;
}

/** WhatsApp manda notas de voz e imágenes de pocos MB; un PDF puede pesar más. */
export const AI_MEDIA_MAX_BYTES = 15 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const PDF_TEXT_MAX = 6000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const LONE_URL = /^https?:\/\/\S+$/i;

const LABEL: Readonly<Record<AiMediaKind, { readonly noun: string; readonly switch: string }>> = {
  audio: { noun: "un audio", switch: "Audios" },
  image: { noun: "una imagen", switch: "Imágenes" },
  pdf: { noun: "un PDF", switch: "PDF" }
};

/** El tipo real del archivo: imágenes y PDF por su firma, también los audios de WhatsApp. */
export function detectMediaType(bytes: Uint8Array, declared = ""): string {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (starts(0x4f, 0x67, 0x67, 0x53)) return "audio/ogg";
  if (starts(0x49, 0x44, 0x33) || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)) return "audio/mpeg";
  if (ascii(0, 5) === "#!AMR") return "audio/amr";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (ascii(4, 8) === "ftyp" && /^M4A/.test(ascii(8, 11))) return "audio/mp4";
  return detectDocumentType(bytes, declared);
}

function kindOf(type: string): AiMediaKind | null {
  if (type === "application/pdf") return "pdf";
  if (IMAGE_TYPES.has(type)) return "image";
  if (type.startsWith("audio/")) return "audio";
  return null;
}

function allowed(config: AiConfig, kind: AiMediaKind): boolean {
  return kind === "audio" ? config.understandAudio : kind === "image" ? config.understandImage : config.understandPdf;
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

/**
 * Prepara el mensaje para la IA. `rendered` ya trae sus variables; `payload`
 * es el mensaje que acaba de llegar (`mediaUrl`, `mediaType`).
 */
export async function prepareAiMedia(
  config: AiConfig,
  nodeId: string,
  rendered: string,
  payload: Readonly<Record<string, unknown>>,
  ports: AiMediaPorts | undefined
): Promise<AiMediaInput> {
  const plain: AiMediaInput = { text: rendered, attachments: [], events: [] };
  if (!(config.understandAudio || config.understandImage || config.understandPdf) || !ports) return plain;

  const trimmed = rendered.trim();
  const inbound = typeof payload["mediaUrl"] === "string" && LONE_URL.test(payload["mediaUrl"]) ? payload["mediaUrl"] : "";
  // Un enlace suelto como mensaje puede ser el archivo, o un enlace que escribió el cliente.
  const fromText = LONE_URL.test(trimmed);
  const url = fromText ? trimmed : inbound;
  if (!url) return plain;
  const text = fromText ? "" : rendered;
  const declared = !fromText || trimmed === inbound ? (typeof payload["mediaType"] === "string" ? payload["mediaType"] : "") : "";

  const fetched = await ports.fetcher.fetch({ url, maxBytes: AI_MEDIA_MAX_BYTES, timeoutMs: DOWNLOAD_TIMEOUT_MS });
  if (!fetched.ok) {
    const events = [`ai_media_unreadable:${nodeId}`];
    if (fromText && trimmed !== inbound) return { ...plain, events };
    return text.trim() ? { text, attachments: [], events } : { text, attachments: [], events, failure: `No se pudo descargar el archivo del cliente: ${fetched.message}` };
  }

  const type = detectMediaType(fetched.media.bytes, declared || fetched.media.contentType);
  const kind = kindOf(type);
  // Un video, un sticker o una página web: la IA sigue solo con el texto.
  if (!kind) return fromText && trimmed !== inbound ? plain : { text, attachments: [], events: [`ai_media_ignored:${nodeId}:${type || "desconocido"}`] };

  if (!allowed(config, kind)) {
    const events = [`ai_media_disabled:${nodeId}:${kind}`];
    if (text.trim()) return { text, attachments: [], events };
    return { text, attachments: [], kind, events, failure: `El cliente mandó ${LABEL[kind].noun} y el bloque no tiene activado «${LABEL[kind].switch}».` };
  }

  const events = [`ai_media_used:${nodeId}:${kind}`];
  if (kind !== "pdf") {
    return { text, attachments: [{ kind, mimeType: type, data: base64(fetched.media.bytes) }], kind, events };
  }

  const read = await ports.reader.read({ bytes: fetched.media.bytes, contentType: type });
  if (!read.ok) {
    const unreadable = [`ai_media_unreadable:${nodeId}`];
    return text.trim() ? { text, attachments: [], events: unreadable } : { text, attachments: [], kind, events: unreadable, failure: `No se pudo leer el PDF del cliente: ${read.message}` };
  }
  const pdf = read.text.trim().slice(0, PDF_TEXT_MAX);
  return { text: [text.trim(), `Texto del PDF que mandó el cliente:\n${pdf}`].filter(Boolean).join("\n\n"), attachments: [], kind, events };
}
