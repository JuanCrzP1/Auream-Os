import {
  MAX_AGENT_MESSAGE_LENGTH,
  MAX_AGENT_MESSAGE_PARTS,
  type AgentMedia,
  type AgentMessagePart
} from "../../../contracts/ConversationContracts";
import type { OutboundMessage } from "../../../contracts/RuntimeContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Lo que envía un asesor desde el chat, validado (llega del navegador): uno o
// varios mensajes en orden —textos y archivos con leyenda— y, si cita un
// mensaje, cuál. También la reacción con un emoji.
// ---------------------------------------------------------------------------

export interface AgentReply {
  readonly parts: ReadonlyArray<AgentMessagePart>;
  readonly replyToId?: string;
}

const MEDIA_TYPES: ReadonlyArray<AgentMedia["type"]> = ["image", "video", "audio", "file"];

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

function cleanText(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > MAX_AGENT_MESSAGE_LENGTH) throw new ValidationError(`${label} admite hasta ${MAX_AGENT_MESSAGE_LENGTH} caracteres.`);
  return text;
}

function cleanMedia(value: unknown): AgentMedia {
  const media = record(value);
  const type = media["type"];
  if (typeof type !== "string" || !(MEDIA_TYPES as ReadonlyArray<string>).includes(type)) throw new ValidationError("Tipo de archivo no válido.");
  const url = typeof media["url"] === "string" ? media["url"].trim() : "";
  if (!/^https:\/\/\S+$/i.test(url) || url.length > 2048) throw new ValidationError("El archivo no tiene un enlace válido. Vuelve a adjuntarlo.");
  const fileName = typeof media["fileName"] === "string" ? media["fileName"].trim().slice(0, 200) : "";
  return {
    type: type as AgentMedia["type"],
    url,
    ...(fileName ? { fileName } : {}),
    ...(media["voice"] === true && type === "audio" ? { voice: true } : {})
  };
}

function cleanPart(value: unknown): AgentMessagePart | null {
  const part = record(value);
  if (part["kind"] === "text") {
    const text = cleanText(part["text"], "Cada mensaje");
    return text ? { kind: "text", text } : null;
  }
  if (part["kind"] === "media") {
    const caption = cleanText(part["caption"], "La leyenda");
    return { kind: "media", media: cleanMedia(part["media"]), ...(caption ? { caption } : {}) };
  }
  throw new ValidationError("Una parte del mensaje no es válida.");
}

/** `{ text }` (un mensaje) o `{ parts }` (varios en orden), con `replyToId` opcional. */
export function parseAgentReply(input: unknown): AgentReply {
  const body = typeof input === "string" ? { text: input } : record(input);
  const raw = Array.isArray(body["parts"]) ? body["parts"] : [{ kind: "text", text: body["text"] }];
  if (raw.length > MAX_AGENT_MESSAGE_PARTS) throw new ValidationError(`Envía hasta ${MAX_AGENT_MESSAGE_PARTS} mensajes a la vez.`);
  const parts = raw.map(cleanPart).filter((part): part is AgentMessagePart => part !== null);
  if (parts.length === 0) throw new ValidationError("Escribe un mensaje.");
  const replyToId = typeof body["replyToId"] === "string" && body["replyToId"].length <= 64 ? body["replyToId"] : undefined;
  return { parts, ...(replyToId ? { replyToId } : {}) };
}

/** Las salidas hacia WhatsApp, en orden; la primera cita el mensaje (`replyProviderId`) si hay. */
export function toOutbound(parts: ReadonlyArray<AgentMessagePart>, conversationKey: string, replyProviderId?: string | null): OutboundMessage[] {
  return parts.map((part, index) => {
    const quote = index === 0 && replyProviderId ? { replyToMessageId: replyProviderId } : {};
    if (part.kind === "text") return { channel: "whatsapp", conversationKey, content: part.text, ...quote };
    return { channel: "whatsapp", conversationKey, kind: "media", content: part.caption ?? "", media: part.media, ...quote };
  });
}

/** Un emoji (o vacío, para quitar la reacción). Nada de letras ni textos largos. */
export function parseReaction(value: unknown): string {
  const emoji = typeof value === "string" ? value.trim() : "";
  if (emoji === "") return "";
  const pictographic = /\p{Extended_Pictographic}/u.test(emoji);
  if (!pictographic || emoji.length > 16 || /[\p{L}\p{N}\s]/u.test(emoji.replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu, ""))) {
    throw new ValidationError("La reacción debe ser un emoji.");
  }
  return emoji;
}
