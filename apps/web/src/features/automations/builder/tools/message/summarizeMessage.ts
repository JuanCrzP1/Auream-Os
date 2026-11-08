import type { ToolData } from "../ToolDefinition";
import { MESSAGE_ITEM_LABELS } from "./messageItems";
import { readMessageItems } from "./readMessageConfig";

/** «<Tipo del primer bloque> · <N> bloque(s)». Resume, no reproduce el contenido. */
export function summarizeMessage(content: ToolData, config: ToolData): string {
  const items = readMessageItems(config, content);

  if (items.length === 0) return "Mensaje vacío";

  const kind = MESSAGE_ITEM_LABELS[items[0].kind];
  const noun = items.length === 1 ? "bloque" : "bloques";

  return `${kind} · ${items.length} ${noun}`;
}
