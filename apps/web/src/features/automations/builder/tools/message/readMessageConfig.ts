import type { ToolData } from "../ToolDefinition";
import type { MessageIntervalUnit, MessageItem, MessageItemKind } from "./types";
import { MESSAGE_INTERVAL_UNITS, MESSAGE_ITEM_KINDS, isMediaKind } from "./messageItems";

// ---------------------------------------------------------------------------
// Lectura defensiva de la secuencia (JSON de disco). También es el punto de
// compatibilidad: un nodo sin `items` y con `content.text` se lee como un
// único bloque de texto.
// ---------------------------------------------------------------------------

function isKind(value: unknown): value is MessageItemKind {
  return typeof value === "string" && (MESSAGE_ITEM_KINDS as ReadonlyArray<string>).includes(value);
}

function toUnit(value: unknown): MessageIntervalUnit {
  return MESSAGE_INTERVAL_UNITS.find((unit) => unit.value === value)?.value ?? "seconds";
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toItem(raw: unknown, index: number): MessageItem | null {
  if (typeof raw !== "object" || raw === null) return null;

  const record = raw as Record<string, unknown>;
  if (!isKind(record.kind)) return null;

  // Sin id es recuperable (ordena bloques dentro del nodo, no conecta aristas).
  const id = typeof record.id === "string" && record.id.length > 0 ? record.id : `mi-legacy-${index}`;

  if (record.kind === "text") {
    return { id, kind: "text", text: toText(record.text) };
  }

  if (record.kind === "interval") {
    const amount = typeof record.amount === "number" && Number.isFinite(record.amount) ? record.amount : 5;
    return { id, kind: "interval", amount, unit: toUnit(record.unit) };
  }

  if (isMediaKind(record.kind)) {
    return {
      id,
      kind: record.kind,
      url: toText(record.url),
      fileName: toText(record.fileName),
      caption: toText(record.caption),
      sendOnce: record.sendOnce === true
    };
  }

  return null;
}

/** Bloques legibles. Lista vacía es válida (nodo recién creado o vaciado). */
export function readMessageItems(config: ToolData, content: ToolData): MessageItem[] {
  const raw = config.items;

  if (Array.isArray(raw)) {
    return raw.map(toItem).filter((item): item is MessageItem => item !== null);
  }

  const legacy = content.text;
  if (typeof legacy === "string" && legacy.length > 0) {
    return [{ id: "mi-legacy-0", kind: "text", text: legacy }];
  }

  return [];
}
