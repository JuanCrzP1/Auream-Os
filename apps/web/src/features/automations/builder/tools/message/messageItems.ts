import { createLocalId } from "../_kit/createLocalId";
import { withoutLocalFile } from "./mediaSource";
import type { MessageIntervalUnit, MessageItem, MessageItemKind, MessageMediaKind } from "./types";

// ---------------------------------------------------------------------------
// Operaciones puras sobre la secuencia de bloques. Siempre devuelven una lista
// nueva: una mutación en el sitio se le escaparía a React.
// ---------------------------------------------------------------------------

/** Orden de la biblioteca. */
export const MESSAGE_ITEM_KINDS: ReadonlyArray<MessageItemKind> = [
  "text",
  "image",
  "video",
  "audio",
  "file",
  "interval"
];

export const MESSAGE_ITEM_LABELS: Readonly<Record<MessageItemKind, string>> = {
  text: "Texto",
  image: "Imagen",
  video: "Video",
  audio: "Audio",
  file: "Archivo",
  interval: "Intervalo"
};

export const MESSAGE_INTERVAL_UNITS: ReadonlyArray<{
  readonly value: MessageIntervalUnit;
  readonly label: string;
}> = [
  { value: "seconds", label: "segundos" },
  { value: "minutes", label: "minutos" },
  { value: "hours", label: "horas" }
];

const MEDIA_KINDS: ReadonlyArray<MessageItemKind> = ["image", "video", "audio", "file"];

export function isMediaKind(kind: MessageItemKind): kind is MessageMediaKind {
  return MEDIA_KINDS.includes(kind);
}

/**
 * `true` si el motor sabe entregar este bloque: todos (texto, archivos y
 * pausas). Un archivo necesita además su URL; eso lo valida el editor.
 */
export function isExecutableKind(kind: MessageItemKind): boolean {
  return (MESSAGE_ITEM_KINDS as ReadonlyArray<string>).includes(kind);
}

/** Identidad de un bloque nuevo. Única fuente de ids del módulo. */
export function nextItemId(): string {
  return createLocalId("mi");
}

export function createMessageItem(kind: MessageItemKind): MessageItem {
  if (kind === "text") return { id: nextItemId(), kind, text: "" };
  if (kind === "interval") return { id: nextItemId(), kind, amount: 5, unit: "seconds" };
  return { id: nextItemId(), kind, url: "", caption: "", sendOnce: false };
}

export function appendItem(items: ReadonlyArray<MessageItem>, kind: MessageItemKind): MessageItem[] {
  return [...items, createMessageItem(kind)];
}

/** Inserta en una posición (soltar entre dos bloques). Fuera de rango = al final. */
export function insertItem(
  items: ReadonlyArray<MessageItem>,
  kind: MessageItemKind,
  atIndex: number
): MessageItem[] {
  const target = Math.max(0, Math.min(atIndex, items.length));
  return [...items.slice(0, target), createMessageItem(kind), ...items.slice(target)];
}

/** Cambios admitidos sobre un bloque: nunca su identidad ni su tipo. */
export type MessageItemChange = Partial<Omit<MessageItem, "id" | "kind">>;

export function updateItem(
  items: ReadonlyArray<MessageItem>,
  itemId: string,
  change: MessageItemChange
): MessageItem[] {
  return items.map((item) => (item.id === itemId ? ({ ...item, ...change } as MessageItem) : item));
}

export function removeItem(items: ReadonlyArray<MessageItem>, itemId: string): MessageItem[] {
  return items.filter((item) => item.id !== itemId);
}

/**
 * Copia un bloque justo detrás del original. La copia estrena id y, por eso,
 * pierde el archivo local (sus bytes están indexados por el id original).
 */
export function duplicateItem(items: ReadonlyArray<MessageItem>, itemId: string): MessageItem[] {
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) return [...items];

  const copy = withoutLocalFile({ ...items[index], id: nextItemId() } as MessageItem);
  return [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
}

/** Mueve un bloque. Fuera de rango = al final. */
export function moveItem(items: ReadonlyArray<MessageItem>, itemId: string, toIndex: number): MessageItem[] {
  const from = items.findIndex((item) => item.id === itemId);
  if (from === -1) return [...items];

  const target = Math.max(0, Math.min(toIndex, items.length - 1));
  if (target === from) return [...items];

  const rest = items.filter((item) => item.id !== itemId);
  return [...rest.slice(0, target), items[from], ...rest.slice(target)];
}
