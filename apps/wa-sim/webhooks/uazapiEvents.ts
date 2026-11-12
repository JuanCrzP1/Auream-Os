import type { ReceiptState, SimContact, SimGroup, SimInstance, SimMessage } from "../core/types";

// ---------------------------------------------------------------------------
// Los avisos que el simulador le manda a Auream, con la MISMA forma que los
// de uazapi (docs.uazapi.com/webhook): así Auream los lee con sus parsers
// reales (`parseUazapiMessage`, `parseUazapiReceipt`, `parseUazapiGroupEvent`
// y la ruta de conexión). Si uazapi cambia, se cambia aquí y en esos parsers.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

const jidOf = (phone: string) => `${phone}@s.whatsapp.net`;

/** Tipo de mensaje de WhatsApp (`messageType`) de lo que envía el cliente. */
const MESSAGE_TYPES: Readonly<Record<SimMessage["kind"], string>> = {
  text: "Conversation",
  image: "ImageMessage",
  video: "VideoMessage",
  audio: "AudioMessage",
  document: "DocumentMessage",
  menu: "Conversation",
  button_reply: "ButtonsResponseMessage",
  list_reply: "ListResponseMessage"
};

const base = (instance: SimInstance, eventType: string): Json => ({
  EventType: eventType,
  instanceName: instance.name,
  token: instance.token,
  owner: instance.phone ?? ""
});

/** El número se conectó, está conectando o se desconectó. */
export function connectionEvent(instance: SimInstance): Json {
  return { ...base(instance, "connection"), instance: { id: instance.id, name: instance.name, status: instance.status, profileName: instance.profileName ?? "" } };
}

/** Un cliente escribió (texto, archivo, nota de voz o respuesta a un botón o lista). */
export function messageEvent(instance: SimInstance, contact: SimContact, message: SimMessage): Json {
  const content: Json = {};
  if (message.choiceId) {
    content["selectedButtonId"] = message.choiceId;
    content["selectedDisplayText"] = message.text;
  }
  if (message.mediaUrl) {
    content["URL"] = message.mediaUrl;
    content["mimetype"] = message.mimeType ?? "";
    if (message.text) content["caption"] = message.text;
  }
  if (contact.ad) {
    content["contextInfo"] = {
      conversionSource: "FB_Ads",
      externalAdReply: { sourceId: contact.ad.sourceId, sourceUrl: contact.ad.sourceUrl, ctwaClid: contact.ad.ctwaClid, sourceType: "ad" }
    };
  }
  const quoted = message.replyTo ? { quoted: message.replyTo } : {};
  return {
    ...base(instance, "messages"),
    message: {
      messageid: message.id,
      id: `${instance.phone ?? ""}:${message.id}`,
      chatid: jidOf(contact.phone),
      sender: jidOf(contact.phone),
      senderName: contact.name,
      fromMe: false,
      wasSentByApi: false,
      isGroup: false,
      messageType: message.voice ? "AudioMessage" : MESSAGE_TYPES[message.kind],
      text: message.text,
      messageTimestamp: Date.parse(message.at),
      ...(message.mediaUrl ? { fileURL: message.mediaUrl, mimetype: message.mimeType ?? "" } : {}),
      ...(message.choiceId ? { buttonOrListid: message.choiceId } : {}),
      ...quoted,
      content
    },
    chat: { wa_chatid: jidOf(contact.phone), name: contact.name }
  };
}

const RECEIPT_STATES: Readonly<Record<ReceiptState, string>> = { sent: "ServerAck", delivered: "Delivered", read: "Read" };

/** Entregado o leído de mensajes que mandó el negocio. */
export function receiptEvent(instance: SimInstance, contactPhone: string, messageIds: ReadonlyArray<string>, state: ReceiptState): Json {
  return {
    ...base(instance, "messages_update"),
    type: "ReadReceipt",
    state: RECEIPT_STATES[state],
    event: { MessageIDs: [...messageIds], Type: RECEIPT_STATES[state], IsFromMe: true, IsGroup: false, chatid: jidOf(contactPhone), Chat: jidOf(contactPhone) }
  };
}

/** Alguien entró a un grupo o salió de él. */
export function groupMembersEvent(instance: SimInstance, group: SimGroup, joins: ReadonlyArray<string>, leaves: ReadonlyArray<string>): Json {
  return { ...base(instance, "groups"), chatid: group.jid, event: { JID: group.jid, Join: joins.map(jidOf), Leave: leaves.map(jidOf) } };
}

/** Un grupo como lo devuelve /group/list. */
export function groupInfo(instance: SimInstance, group: SimGroup): Json {
  return {
    JID: group.jid,
    Name: group.name,
    Topic: group.description,
    IsAnnounce: group.announce,
    IsLocked: group.locked,
    OwnerJID: instance.phone ? jidOf(instance.phone) : "",
    OwnerIsAdmin: true,
    ParticipantCount: group.participants.length + 1,
    Participants: [
      ...(instance.phone ? [{ JID: jidOf(instance.phone), PhoneNumber: jidOf(instance.phone), IsAdmin: true, IsSuperAdmin: true }] : []),
      ...group.participants.map((phone) => ({ JID: jidOf(phone), PhoneNumber: jidOf(phone), IsAdmin: false }))
    ],
    image_url: group.image ?? "",
    invite_link: `https://chat.whatsapp.com/${group.inviteCode}`
  };
}
