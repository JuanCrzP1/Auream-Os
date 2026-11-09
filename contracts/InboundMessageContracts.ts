// ---------------------------------------------------------------------------
// Un mensaje que un cliente le escribió a un número de la cuenta, ya
// traducido del formato del proveedor (uazapi, Meta…) a uno solo. Es lo que
// recibe la mensajería entrante; no conoce al proveedor.
// ---------------------------------------------------------------------------

export type InboundMessageKind =
  | "text"
  | "button_reply"
  | "list_reply"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "other";

export interface InboundChannelMessage {
  /** Conexión (número de la cuenta) que lo recibió. */
  readonly connectionId: string;
  /** Id del mensaje en el proveedor: evita procesarlo dos veces. */
  readonly providerMessageId: string;
  /** Teléfono del cliente, solo dígitos con indicativo. */
  readonly phone: string;
  /** Nombre del perfil de WhatsApp del cliente, si llega. */
  readonly senderName: string | null;
  readonly kind: InboundMessageKind;
  /** Texto, leyenda o título del botón elegido. Vacío si no hay. */
  readonly text: string;
  /** Id del botón o de la opción de lista elegida. */
  readonly replyId: string | null;
  /** Archivo recibido (imagen, audio, documento…): URL para descargarlo. */
  readonly media: { readonly url: string; readonly mimeType: string | null } | null;
  /** Llegó desde un anuncio de clic a WhatsApp. */
  readonly fromAd: boolean;
  /** Tipo original del proveedor (para el registro y el diagnóstico). */
  readonly providerType: string;
  readonly sentAt: string;
}

/**
 * Qué pasó con un mensaje entrante (queda en el registro):
 *   flow_started    inició un flujo por un disparador
 *   flow_continued  continuó el flujo en que estaba el cliente
 *   no_trigger      ningún disparador del número coincidió
 *   ignored         no se procesa (grupo, propio, estado…)
 *   failed          algo falló (ver el detalle)
 */
export type InboundOutcome = "flow_started" | "flow_continued" | "no_trigger" | "ignored" | "failed";
