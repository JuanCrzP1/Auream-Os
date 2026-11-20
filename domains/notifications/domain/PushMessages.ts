// ---------------------------------------------------------------------------
// Lo que dice cada aviso del celular y a dónde lleva al tocarlo. Puro.
//
//   · `tag`: el mismo tag REEMPLAZA el aviso anterior en vez de sumar otro
//     (cinco mensajes seguidos de una clienta = un aviso que se actualiza).
//   · `url`: la pantalla de Auream donde se resuelve.
//   · Textos cortos: el celular corta lo largo de todas formas.
// ---------------------------------------------------------------------------

export interface PushMessage {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly tag: string;
}

const TITLE_MAX = 70;
const BODY_MAX = 160;

/** Corta en una palabra y agrega «…» si no cabe. */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const MEDIA: Readonly<Record<string, string>> = {
  image: "📷 Foto",
  video: "🎬 Video",
  audio: "🎤 Nota de voz",
  document: "📄 Archivo",
  sticker: "Sticker",
  location: "📍 Ubicación",
  contact: "👤 Contacto"
};

/** Lo que se lee del mensaje: su texto o, si es un archivo sin texto, qué es. */
export function messagePreview(kind: string, text: string): string {
  const clean = text.trim();
  const media = MEDIA[kind];
  if (media) return clean ? `${media}: ${clean}` : media;
  return clean || "Te envió un mensaje";
}

export function chatMessage(input: { readonly contactName: string | null; readonly phone: string; readonly kind: string; readonly text: string; readonly conversationId: string }): PushMessage {
  const who = input.contactName?.trim() || `+${input.phone}`;
  return {
    title: clip(`${who} te escribió`, TITLE_MAX),
    body: clip(messagePreview(input.kind, input.text), BODY_MAX),
    url: `/conversations?search=${input.phone}`,
    tag: `chat:${input.conversationId}`
  };
}

export function numberDisconnected(input: { readonly connectionId: string; readonly connectionName: string }): PushMessage {
  return {
    title: "Número desconectado",
    body: clip(`«${input.connectionName}» se desconectó: tus flujos dejaron de responder en ese número. Vuelve a escanear el QR.`, BODY_MAX),
    url: "/connections",
    tag: `connection:${input.connectionId}`
  };
}

export function saleReview(input: { readonly saleId: string; readonly customerName: string | null; readonly amount: string | null; readonly reason: string | null }): PushMessage {
  const who = input.customerName?.trim() || "Un cliente";
  const what = [input.amount, input.reason].filter((part): part is string => Boolean(part)).join(" · ");
  return {
    title: "Venta por revisar",
    body: clip(what ? `${who} · ${what}` : `${who}: revísala para que cuente en tus ventas.`, BODY_MAX),
    url: "/sales?tab=review",
    tag: `sale:${input.saleId}`
  };
}

export function followUpDue(input: { readonly followUpId: string; readonly title: string; readonly contactName: string | null }): PushMessage {
  return {
    title: clip(`Seguimiento: ${input.title}`, TITLE_MAX),
    body: clip(input.contactName ? `Es hora de contactar a ${input.contactName}.` : "Es hora de este seguimiento.", BODY_MAX),
    url: "/crm?tab=follow-ups",
    tag: `follow-up:${input.followUpId}`
  };
}

/** La prueba de «Enviar una prueba». */
export function testMessage(): PushMessage {
  return { title: "Notificaciones activadas", body: "Así te avisaremos de lo importante, aunque Auream esté cerrado.", url: "/settings/notifications", tag: "test" };
}
