import type { ToolData } from "../ToolDefinition";
import { AI_MODELS, readAiConfig } from "./aiConfig";

export function summarizeAi(_content: ToolData, config: ToolData): string {
  const read = readAiConfig(config);
  const model = AI_MODELS[read.provider].find((option) => option.value === read.model)?.label ?? read.model;

  return read.intents.length > 0 ? `${model} · clasifica ${read.intents.length} intenciones` : `${model} · ${read.responseVariable}`;
}
