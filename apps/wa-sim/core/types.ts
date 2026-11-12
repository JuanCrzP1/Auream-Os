// ---------------------------------------------------------------------------
// Lo que vive en el WhatsApp simulado: los números (instancias de uazapi), los
// clientes de prueba, los mensajes de cada chat y los grupos. Todo es de
// prueba: nada sale a WhatsApp.
// ---------------------------------------------------------------------------

export type InstanceStatus = "disconnected" | "connecting" | "connected";

/** Un número de WhatsApp de la cuenta, como lo ve uazapi (una instancia). */
export interface SimInstance {
  readonly id: string;
  /** Con este token Auream le habla (cabecera `token`) y firma los avisos. */
  readonly token: string;
  /** `auream-<id de la conexión>`: Auream sabe de qué conexión es cada aviso. */
  readonly name: string;
  status: InstanceStatus;
  /** El número que «escaneó» el QR, solo dígitos. */
  phone: string | null;
  profileName: string | null;
  /** A dónde avisa (lo configura Auream con POST /webhook). */
  webhookUrl: string | null;
  webhookEvents: string[];
  createdAt: string;
}

/** Un cliente de prueba (quien le escribe al número). */
export interface SimContact {
  readonly phone: string;
  name: string;
  /** Llega desde un anuncio de clic a WhatsApp: los mensajes traen el anuncio. */
  ad: { sourceId: string; sourceUrl: string; ctwaClid: string } | null;
}

export type MessageKind = "text" | "image" | "video" | "audio" | "document" | "menu" | "button_reply" | "list_reply";
export type ReceiptState = "sent" | "delivered" | "read";

export interface MenuOption {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
}

/** Un mensaje del chat. `fromBusiness`: lo envió Auream; si no, el cliente. */
export interface SimMessage {
  readonly id: string;
  readonly instanceId: string;
  readonly contactPhone: string;
  readonly fromBusiness: boolean;
  readonly kind: MessageKind;
  readonly text: string;
  readonly mediaUrl: string | null;
  readonly mimeType: string | null;
  readonly fileName: string | null;
  /** Nota de voz (`ptt`). */
  readonly voice: boolean;
  readonly menu: { readonly type: "button" | "list"; readonly options: ReadonlyArray<MenuOption>; readonly button?: string } | null;
  /** Id del mensaje citado. */
  readonly replyTo: string | null;
  /** La opción elegida (respuestas a botones o listas). */
  readonly choiceId: string | null;
  /** Emoji que le puso la otra parte. */
  reaction: string | null;
  /** Solo los del negocio: enviado, entregado o leído por el cliente. */
  status: ReceiptState;
  readonly at: string;
}

/** Un grupo de WhatsApp de un número (Grupos y comunidades). */
export interface SimGroup {
  readonly jid: string;
  readonly instanceId: string;
  name: string;
  description: string;
  announce: boolean;
  locked: boolean;
  image: string | null;
  readonly inviteCode: string;
  participants: string[];
}

/** Lo último que pasó (panel de depuración del teléfono de prueba). */
export interface SimLogEntry {
  readonly at: string;
  /** `in`: Auream le pidió algo · `out`: el simulador le avisó a Auream. */
  readonly direction: "in" | "out";
  readonly summary: string;
  readonly ok: boolean;
}

/** «Escribiendo…» o «grabando audio…» que Auream mostró hasta `until`. */
export interface SimPresence {
  readonly state: "composing" | "recording" | "paused";
  readonly until: string;
}
