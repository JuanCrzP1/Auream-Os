import type { ToolData, ToolOutput } from "../ToolDefinition";
import { AI_OUTPUT, intentKeyOf, readAiConfig } from "@contracts/AiConfig";

// La forma de la configuración es el contrato compartido con el motor
// (`contracts/AiConfig.ts`). Aquí: las salidas que pinta el lienzo.
export {
  AI_DEFAULT_CONFIG,
  AI_MAX_CONTEXT_TURNS,
  AI_MAX_INTENTS,
  AI_OUTPUT,
  intentKeyOf,
  readAiConfig,
  type AiConfig,
  type AiIntent
} from "@contracts/AiConfig";

/** Con intenciones: una salida por intención + respaldo + error. Sin ellas: respuesta + error. */
export function aiOutputs(config: ToolData): ReadonlyArray<ToolOutput> {
  const read = readAiConfig(config);
  const failure = { id: AI_OUTPUT.failure, label: "Error" };

  if (read.intents.length === 0) return [{ id: AI_OUTPUT.success, label: "Respuesta" }, failure];

  return [
    ...read.intents.map((intent, index) => ({ id: intent.id, label: intent.key || intentKeyOf(intent, index) })),
    { id: AI_OUTPUT.fallback, label: read.fallbackKey || "Sin coincidencia" },
    failure
  ];
}
