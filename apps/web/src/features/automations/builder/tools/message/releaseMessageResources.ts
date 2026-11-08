import type { ToolData } from "../ToolDefinition";
import { readMessageItems } from "./readMessageConfig";
import { releaseFile } from "./mediaSourceSession";

/** Libera los archivos de sesión de cada bloque antes de borrar el nodo. Idempotente. */
export function releaseMessageResources(config: ToolData): void {
  for (const item of readMessageItems(config, {})) releaseFile(item.id);
}
