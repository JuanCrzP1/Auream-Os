
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
export { aiOutputs } from "@contracts/blocks/outputs";
