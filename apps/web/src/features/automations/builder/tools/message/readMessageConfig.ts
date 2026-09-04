import type { MessageIntervalUnit, MessageItem, MessageItemKind } from "./types";
import { MESSAGE_INTERVAL_UNITS, MESSAGE_ITEM_KINDS, isMediaKind } from "./messageItems";

// ---------------------------------------------------------------------------
// Lectura de la secuencia desde un nodo.
//
// `config` y `content` son `Record<string, unknown>`: vienen de un JSON
// persistido y NO están garantizados por el compilador. Un flujo guardado hace
// meses, editado a mano o escrito por una versión anterior puede traer
// cualquier cosa, así que aquí se estrecha con desconfianza en vez de asumir.
//
// Es también el punto de compatibilidad hacia atrás: un nodo anterior a la
// secuencia trae `content.text` y ningún `items`. Se lee como un único bloque
// de texto, sin migrar nada y sin romperlo.
// ---------------------------------------------------------------------------

function isKind(value: unknown): value is MessageItemKind {
  return typeof value === "string" && (MESSAGE_ITEM_KINDS as ReadonlyArray<string>).includes(value);
}

function toUnit(value: unknown): MessageIntervalUnit {
  const conocida = MESSAGE_INTERVAL_UNITS.find((unidad) => unidad.value === value);
  return conocida?.value ?? "seconds";
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Estrecha un elemento suelto, o lo descarta si no es representable. */
function toItem(raw: unknown, index: number): MessageItem | null {
  if (typeof raw !== "object" || raw === null) return null;

  const record = raw as Record<string, unknown>;
  if (!isKind(record.kind)) return null;

  // Un bloque sin id es recuperable: se le da uno estable por su posición.
  // Descartarlo perdería trabajo del usuario por un detalle que sabemos suplir.
  const id = typeof record.id === "string" && record.id.length > 0 ? record.id : `mi-legacy-${index}`;

  if (record.kind === "text") {
    return { id, kind: "text", text: toText(record.text) };
  }

  if (record.kind === "interval") {
    const amount = typeof record.amount === "number" && Number.isFinite(record.amount)
      ? record.amount
      : 5;

    return { id, kind: "interval", amount, unit: toUnit(record.unit) };
  }

  if (isMediaKind(record.kind)) {
    return {
      id,
      kind: record.kind,
      url: toText(record.url),
      caption: toText(record.caption),
      sendOnce: record.sendOnce === true
    };
  }

  return null;
}

/**
 * Secuencia de bloques de un nodo Mensaje.
 *
 * Devuelve lista vacía cuando no hay nada legible: un Mensaje sin bloques es un
 * estado válido —recién creado, o vaciado por el usuario— y la validación es
 * quien decide si eso puede publicarse, no el lector.
 */
export function readMessageItems(
  config: Readonly<Record<string, unknown>>,
  content: Readonly<Record<string, unknown>>
): MessageItem[] {
  const raw = config.items;

  if (Array.isArray(raw)) {
    return raw.map(toItem).filter((item): item is MessageItem => item !== null);
  }

  // Compatibilidad: nodo anterior a la secuencia.
  const legacy = content.text;
  if (typeof legacy === "string" && legacy.length > 0) {
    return [{ id: "mi-legacy-0", kind: "text", text: legacy }];
  }

  return [];
}
