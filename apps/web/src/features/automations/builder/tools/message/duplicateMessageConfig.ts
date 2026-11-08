import type { ToolData } from "../ToolDefinition";
import { nextItemId } from "./messageItems";
import { withoutLocalFile } from "./mediaSource";
import { readMessageItems } from "./readMessageConfig";

/** Copia para un nodo duplicado: todo el contenido, ids nuevos, sin archivos locales. */
export function duplicateMessageConfig(config: ToolData): Record<string, unknown> {
  const items = readMessageItems(config, {}).map((item) => withoutLocalFile({ ...item, id: nextItemId() }));

  return { ...config, items };
}
