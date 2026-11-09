import type { DeliveryStatus } from "../../../contracts/ConversationContracts";

// ---------------------------------------------------------------------------
// Aviso `messages_update` de uazapi: recibos de entrega y lectura de los
// mensajes que mandamos (docs.uazapi.com/reference/webhooks/messages_update).
//
//   { EventType: "messages_update", instanceName, token, type: "ReadReceipt",
//     state: "Read", event: { MessageIDs: [...], Type: "Read", IsFromMe: true,
//     IsGroup: false, chatid } }
//
// Solo chats individuales. No se filtra por `IsFromMe`: su sentido varía
// (WhatsApp lo pone en falso cuando el recibo viene del cliente) y no hace
// falta, porque el recibo solo marca mensajes salientes con ese id de WhatsApp
// en el mismo número (`markDelivery`); los ids de mensajes del cliente no
// coinciden con ninguno.
// Estados: Sent/ServerAck → enviado, Delivered → entregado, Read/Played → leído.
// ---------------------------------------------------------------------------

export interface ParsedUazapiReceipt {
  readonly instanceName: string;
  readonly token: string;
  readonly providerMessageIds: ReadonlyArray<string>;
  readonly status: DeliveryStatus;
}

export type UazapiReceiptParse = { readonly ok: true; readonly receipt: ParsedUazapiReceipt } | { readonly ok: false; readonly ignored: string };

type Json = Record<string, unknown>;
const record = (value: unknown): Json => (typeof value === "object" && value !== null ? (value as Json) : {});
const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const STATES: Readonly<Record<string, DeliveryStatus>> = {
  sent: "sent",
  serverack: "sent",
  delivered: "delivered",
  deliveryack: "delivered",
  read: "read",
  played: "read"
};

export function parseUazapiReceipt(body: Json): UazapiReceiptParse {
  if (str(body["EventType"]) !== "messages_update") return { ok: false, ignored: "no es un recibo" };
  const instanceName = str(body["instanceName"]);
  const token = str(body["token"]);
  const event = record(body["event"]);
  if (!instanceName || !token || Object.keys(event).length === 0) return { ok: false, ignored: "aviso incompleto" };

  const chatId = str(event["chatid"]) || str(event["Chat"]);
  if (event["IsGroup"] === true || /@(g\.us|newsletter|broadcast)$/.test(chatId)) return { ok: false, ignored: "grupo o canal" };

  const status = STATES[(str(body["state"]) || str(event["Type"])).toLowerCase()];
  if (!status) return { ok: false, ignored: "estado sin uso" };

  const raw = event["MessageIDs"];
  const ids = (Array.isArray(raw) ? raw : []).map(str).filter((id) => id.length > 0 && id.length <= 128).slice(0, 100);
  if (ids.length === 0) return { ok: false, ignored: "sin ids de mensaje" };
  return { ok: true, receipt: { instanceName, token, providerMessageIds: ids, status } };
}
