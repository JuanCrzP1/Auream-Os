import type { ToolData } from "../ToolDefinition";
import { readTagsConfig } from "./tagsConfig";

export function summarizeTags(_content: ToolData, config: ToolData): string {
  const { action, tags } = readTagsConfig(config);
  if (tags.length === 0) return "Sin etiquetas";

  return `${action === "add" ? "Agregar" : "Quitar"}: ${tags.join(", ")}`;
}
