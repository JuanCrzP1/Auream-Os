import type { IntervalUnit } from "./IntervalConfig";

// ---------------------------------------------------------------------------
// Mensaje — contrato de configuración compartido por el builder (editor) y el
// motor (MessageNodeHandler): una SECUENCIA de bloques en `config.items`.
//
//   text      texto con variables
//   image · video · audio · file   un archivo (URL pública: Vercel Blob o un enlace)
//   interval  una pausa entre bloques
//
// `content.text` solo se lee por compatibilidad con nodos anteriores.
// ---------------------------------------------------------------------------

export type MessageItemKind = "text" | "image" | "video" | "audio" | "file" | "interval";
export type MessageMediaKind = "image" | "video" | "audio" | "file";
/** Una pausa dentro de un mensaje no dura días. */
export type MessageIntervalUnit = Exclude<IntervalUnit, "days">;

export const MESSAGE_ITEM_KINDS: ReadonlyArray<MessageItemKind> = ["text", "image", "video", "audio", "file", "interval"];
export const MESSAGE_MEDIA_KINDS: ReadonlyArray<MessageMediaKind> = ["image", "video", "audio", "file"];
export const MESSAGE_INTERVAL_UNIT_VALUES: ReadonlyArray<MessageIntervalUnit> = ["seconds", "minutes", "hours"];

interface MessageItemBase {
  /** Identidad estable: sin ella, reordenar re-monta los campos y pierde el foco. */
  readonly id: string;
}

export interface MessageTextItem extends MessageItemBase {
  readonly kind: "text";
  readonly text: string;
}

/**
 * Imagen, video, audio o archivo: un enlace escrito o un archivo subido al
 * almacén de la cuenta (queda su URL pública en `url`, su nombre en
 * `fileName` y el registro en `mediaId`). Sin `url` no hay nada que enviar.
 */
export interface MessageMediaItem extends MessageItemBase {
  readonly kind: MessageMediaKind;
  readonly url: string;
  readonly fileName?: string;
  /** Registro del archivo subido (`media_assets.id`). */
  readonly mediaId?: string;
  readonly caption: string;
  /** Enviar una sola vez por conversación. */
  readonly sendOnce: boolean;
  /**
   * «Ver una sola vez» de WhatsApp (como en Leona): el cliente lo abre una vez
   * y desaparece del chat. Solo imagen, video y audio; un archivo no puede.
   */
  readonly viewOnce?: boolean;
}

/** Qué medios admite «Ver una sola vez» en WhatsApp. */
export function canViewOnce(kind: MessageMediaKind): boolean {
  return kind !== "file";
}

/** Pausa entre dos bloques. No es el Programador, que suspende la sesión entera. */
export interface MessageIntervalItem extends MessageItemBase {
  readonly kind: "interval";
  readonly amount: number;
  readonly unit: MessageIntervalUnit;
}

export type MessageItem = MessageTextItem | MessageMediaItem | MessageIntervalItem;

export function isMessageMediaKind(kind: string): kind is MessageMediaKind {
  return (MESSAGE_MEDIA_KINDS as ReadonlyArray<string>).includes(kind);
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

function toItem(raw: unknown, index: number): MessageItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const kind = record["kind"];
  if (typeof kind !== "string" || !(MESSAGE_ITEM_KINDS as ReadonlyArray<string>).includes(kind)) return null;

  // Sin id es recuperable (ordena bloques dentro del nodo, no conecta aristas).
  const id = typeof record["id"] === "string" && record["id"].length > 0 ? record["id"] : `mi-legacy-${index}`;

  if (kind === "text") return { id, kind, text: text(record["text"]) };

  if (kind === "interval") {
    const amount = typeof record["amount"] === "number" && Number.isFinite(record["amount"]) ? record["amount"] : 5;
    const unit = (MESSAGE_INTERVAL_UNIT_VALUES as ReadonlyArray<unknown>).includes(record["unit"]) ? (record["unit"] as MessageIntervalUnit) : "seconds";
    return { id, kind, amount, unit };
  }

  return {
    id,
    kind: kind as MessageMediaKind,
    url: text(record["url"]),
    fileName: text(record["fileName"]),
    ...(typeof record["mediaId"] === "string" && record["mediaId"] ? { mediaId: record["mediaId"] } : {}),
    caption: text(record["caption"]),
    sendOnce: record["sendOnce"] === true,
    ...(record["viewOnce"] === true && canViewOnce(kind as MessageMediaKind) ? { viewOnce: true } : {})
  };
}

/** Bloques legibles de un nodo Mensaje. Lista vacía es válida (recién creado o vaciado). */
export function readMessageItems(config: Readonly<Record<string, unknown>>, content: Readonly<Record<string, unknown>>): MessageItem[] {
  const raw = config["items"];
  if (Array.isArray(raw)) return raw.map(toItem).filter((item): item is MessageItem => item !== null);

  const legacy = content["text"];
  return typeof legacy === "string" && legacy.length > 0 ? [{ id: "mi-legacy-0", kind: "text", text: legacy }] : [];
}

const UNIT_MS: Readonly<Record<MessageIntervalUnit, number>> = { seconds: 1_000, minutes: 60_000, hours: 3_600_000 };

/** Duración de una pausa en milisegundos (nunca negativa). */
export function intervalMs(item: Pick<MessageIntervalItem, "amount" | "unit">): number {
  return Math.max(0, Math.round(item.amount * UNIT_MS[item.unit]));
}
