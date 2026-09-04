import type {
  MessageIntervalUnit,
  MessageItem,
  MessageItemKind,
  MessageMediaKind
} from "./types";

// ---------------------------------------------------------------------------
// Operaciones sobre la secuencia de bloques de un Mensaje.
//
// Puras y sin React: las consume el editor, pero también el resumen y la
// validación, y ninguna de esas dos debería arrastrar un componente.
//
// Todas devuelven una lista NUEVA. La secuencia que guarda el nodo nunca se
// muta en el sitio: el mutador genérico compara y clona, y una mutación en el
// sitio se le escaparía sin que React llegara a repintar.
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

/** Nombre de producto de cada bloque. */
export const MESSAGE_ITEM_LABELS: Readonly<Record<MessageItemKind, string>> = {
  text: "Texto",
  image: "Imagen",
  video: "Video",
  audio: "Audio",
  file: "Archivo",
  interval: "Intervalo"
};

/** Unidades de una pausa, en el orden en que se ofrecen. */
export const MESSAGE_INTERVAL_UNITS: ReadonlyArray<{
  readonly value: MessageIntervalUnit;
  readonly label: string;
}> = [
  { value: "seconds", label: "segundos" },
  { value: "minutes", label: "minutos" },
  { value: "hours", label: "horas" }
];

const MEDIA_KINDS: ReadonlyArray<MessageItemKind> = ["image", "video", "audio", "file"];

/** `true` si el bloque referencia un archivo. */
export function isMediaKind(kind: MessageItemKind): kind is MessageMediaKind {
  return MEDIA_KINDS.includes(kind);
}

/**
 * `true` si el motor sabe entregar este bloque hoy.
 *
 * Solo el texto. `OutboundMessage` tiene un único campo de contenido, de tipo
 * cadena, así que no hay por dónde transportar un archivo ni cómo expresar una
 * pausa. Lo consume el RUNTIME para decidir qué emite; la interfaz no lo usa
 * para marcar nada, porque el usuario está configurando lo que su mensaje será,
 * no auditando qué partes del motor están construidas.
 */
export function isExecutableKind(kind: MessageItemKind): boolean {
  return kind === "text";
}

let sequence = 0;

/**
 * Identificador de un bloque nuevo.
 *
 * Local y efímero: solo tiene que ser único dentro de la secuencia de un nodo
 * para que el reordenamiento no pierda el foco. No identifica nada fuera de
 * aquí, así que no necesita ser un UUID.
 */
function nextItemId(): string {
  sequence += 1;
  return `mi-${Date.now().toString(36)}-${sequence}`;
}

/** Bloque nuevo y vacío del tipo pedido. */
export function createMessageItem(kind: MessageItemKind): MessageItem {
  if (kind === "text") return { id: nextItemId(), kind, text: "" };
  if (kind === "interval") return { id: nextItemId(), kind, amount: 5, unit: "seconds" };
  return { id: nextItemId(), kind, url: "", caption: "", sendOnce: false };
}

/** Añade al final de la secuencia. */
export function appendItem(
  items: ReadonlyArray<MessageItem>,
  kind: MessageItemKind
): MessageItem[] {
  return [...items, createMessageItem(kind)];
}

/**
 * Inserta en una posición concreta.
 *
 * Lo necesita soltar desde la biblioteca: el usuario suelta ENTRE dos bloques y
 * espera que aparezca ahí, no al final. El índice se acota, porque soltar más
 * allá del último es un gesto legítimo que significa «al final».
 */
export function insertItem(
  items: ReadonlyArray<MessageItem>,
  kind: MessageItemKind,
  atIndex: number
): MessageItem[] {
  const destino = Math.max(0, Math.min(atIndex, items.length));
  return [...items.slice(0, destino), createMessageItem(kind), ...items.slice(destino)];
}

/** Cambios admitidos sobre un bloque. Nunca su identidad ni su tipo. */
export type MessageItemChange = Partial<Omit<MessageItem, "id" | "kind">>;

/** Sustituye un bloque por su versión editada. */
export function updateItem(
  items: ReadonlyArray<MessageItem>,
  itemId: string,
  change: MessageItemChange
): MessageItem[] {
  return items.map((item) => (item.id === itemId ? ({ ...item, ...change } as MessageItem) : item));
}

/** Quita un bloque. */
export function removeItem(items: ReadonlyArray<MessageItem>, itemId: string): MessageItem[] {
  return items.filter((item) => item.id !== itemId);
}

/**
 * Copia un bloque justo detrás del original.
 *
 * Detrás y no al final: duplicar sirve para repetir algo en su sitio, y mandar
 * la copia al final obligaría a reordenar cada vez.
 */
export function duplicateItem(
  items: ReadonlyArray<MessageItem>,
  itemId: string
): MessageItem[] {
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) return [...items];

  const copia = { ...items[index], id: nextItemId() } as MessageItem;
  return [...items.slice(0, index + 1), copia, ...items.slice(index + 1)];
}

/**
 * Mueve un bloque a otra posición de la secuencia.
 *
 * El destino se acota en lugar de rechazarse: soltar más allá del final es un
 * gesto legítimo del usuario y significa «al final», no un error.
 */
export function moveItem(
  items: ReadonlyArray<MessageItem>,
  itemId: string,
  toIndex: number
): MessageItem[] {
  const from = items.findIndex((item) => item.id === itemId);
  if (from === -1) return [...items];

  const destino = Math.max(0, Math.min(toIndex, items.length - 1));
  if (destino === from) return [...items];

  const resto = items.filter((item) => item.id !== itemId);
  return [...resto.slice(0, destino), items[from], ...resto.slice(destino)];
}
