import type { ToolData } from "../ToolDefinition";
import { readAiConfig } from "./aiConfig";

export function summarizeAi(_content: ToolData, config: ToolData): string {
  const read = readAiConfig(config);
  if (!read.credentialId || !read.model) return "Sin conexión de IA";
  return read.intents.length > 0 ? `${read.model} · clasifica ${read.intents.length} intenciones` : `${read.model} · ${read.responseVariable}`;
}
