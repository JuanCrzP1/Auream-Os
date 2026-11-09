import type { InboundChannelMessage, InboundMessageKind } from "../../../contracts/InboundMessageContracts";

// ---------------------------------------------------------------------------
// Evento `messages` de uazapi → mensaje entrante de Auream. Puro.
//
// Documentado (docs.uazapi.com/webhook/messages): `message.messageid`,
// `chatid`, `sender`, `senderName`, `fromMe`, `isGroup`, `messageType`,
// `text` (texto o leyenda) y `messageTimestamp` (ms). NO documentado: cómo
// llega la respuesta a un botón o lista, los archivos y el anuncio de origen;
// se leen de los campos conocidos de WhatsApp con tolerancia y el tipo
// original queda en el registro para ajustarlo con mensajes reales.
//
// Se ignoran: lo enviado por el propio número o por la API (evita bucles),
// grupos, canales y estados.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;
const record = (value: unknown): Json => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {});
const str = (value: unknown): string => (typeof value === "string" ? value : "");

export interface ParsedUazapiEvent {
  /** `auream-<id de la conexión>`. */
  readonly instanceName: string;
  /** Token de la instancia con que uazapi firma el aviso. */
  readonly token: string;
  readonly message: Omit<InboundChannelMessage, "connectionId">;
  /** Archivo que hay que pedir a uazapi (no vino el enlace). */
  readonly needsMediaDownload: boolean;
}

export type UazapiParse = { readonly ok: true; readonly event: ParsedUazapiEvent } | { readonly ok: false; readonly ignored: string };

function digitsOf(jid: string): string {
  const user = jid.split("@")[0]!.split(":")[0]!;
  return user.replace(/\D/g, "");
}

function kindOf(messageType: string, hasReplyId: boolean): InboundMessageKind {
  const type = messageType.toLowerCase();
  if (type.includes("list")) return "list_reply";
  if (type.includes("button") || type.includes("interactiveresponse") || hasReplyId) return "button_reply";
  if (type.includes("image")) return "image";
  if (type.includes("video")) return "video";
  if (type.includes("audio") || type.includes("ptt")) return "audio";
  if (type.includes("document")) return "document";
  if (type.includes("sticker")) return "sticker";
  if (type.includes("location")) return "location";
  if (type.includes("contact")) return "contact";
  if (type === "" || type.includes("conversation") || type.includes("extendedtext") || type.includes("text")) return "text";
  return "other";
}

const MEDIA_KINDS: ReadonlyArray<InboundMessageKind> = ["image", "video", "audio", "document", "sticker"];

/** ¿Llegó desde un anuncio de clic a WhatsApp? (campos de WhatsApp, no documentados por uazapi). */
function fromAd(message: Json): boolean {
  const content = record(message["content"]);
  const context = record(content["contextInfo"] ?? message["contextInfo"]);
  const reply = record(context["externalAdReply"]);
  return Boolean(str(reply["sourceId"]) || str(reply["sourceID"]) || str(context["conversionSource"]).toLowerCase().includes("ad") || str(context["ctwaClid"]) || message["referral"]);
}

export function parseUazapiMessage(body: unknown): UazapiParse {
  const root = record(body);
  if (str(root["EventType"]) !== "messages") return { ok: false, ignored: "no es un mensaje" };
  const message = record(root["message"]);
  const instanceName = str(root["instanceName"]);
  const token = str(root["token"]);
  if (!instanceName || !token || Object.keys(message).length === 0) return { ok: false, ignored: "aviso incompleto" };

  if (message["fromMe"] === true || message["wasSentByApi"] === true) return { ok: false, ignored: "enviado por el propio número" };
  const chatId = str(message["chatid"]) || str(message["sender"]);
  if (message["isGroup"] === true || /@(g\.us|newsletter|broadcast)$/.test(chatId) || chatId.startsWith("status@")) {
    return { ok: false, ignored: "grupo, canal o estado" };
  }

  // El teléfono: del chat si es una cuenta normal; si no (ids «@lid»), del remitente.
  const phone = [chatId, str(message["sender_pn"]), str(message["sender"])]
    .filter((jid) => jid && !jid.endsWith("@lid"))
    .map(digitsOf)
    .find((digits) => digits.length >= 7 && digits.length <= 15);
  if (!phone) return { ok: false, ignored: "sin teléfono del cliente" };

  const providerMessageId = str(message["messageid"]) || str(message["id"]);
  if (!providerMessageId) return { ok: false, ignored: "sin id de mensaje" };

  const content = record(message["content"]);
  const replyId =
    str(message["buttonOrListid"]) ||
    str(content["selectedButtonId"]) ||
    str(content["selectedId"]) ||
    str(record(content["singleSelectReply"])["selectedRowId"]) ||
    null;
  const messageType = str(message["messageType"]);
  const kind = kindOf(messageType, Boolean(replyId));
  const text = (
    str(message["text"]) ||
    str(content["text"]) ||
    str(content["caption"]) ||
    str(content["selectedDisplayText"]) ||
    str(content["title"]) ||
    (typeof message["content"] === "string" ? str(message["content"]) : "")
  ).trim();

  const fileUrl = str(message["fileURL"]) || str(content["URL"]) || str(content["url"]);
  const mimeType = str(message["mimetype"]) || str(content["mimetype"]) || null;
  const isMedia = MEDIA_KINDS.includes(kind);
  const timestamp = Number(message["messageTimestamp"]);
  const sentAt = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp).toISOString() : new Date().toISOString();

  return {
    ok: true,
    event: {
      instanceName,
      token,
      needsMediaDownload: isMedia && !/^https:\/\//.test(fileUrl),
      message: {
        providerMessageId,
        phone,
        senderName: str(message["senderName"]).trim() || null,
        kind,
        text,
        replyId,
        media: isMedia && /^https:\/\//.test(fileUrl) ? { url: fileUrl, mimeType } : null,
        fromAd: fromAd(message),
        providerType: messageType || "desconocido",
        sentAt
      }
    }
  };
}
