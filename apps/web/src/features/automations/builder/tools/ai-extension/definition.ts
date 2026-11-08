import type { ToolDefinition } from "../ToolDefinition";
import { AI_DEFAULT_CONFIG, aiOutputs } from "./aiConfig";
import { summarizeAi } from "./summarizeAi";
import { validateAi } from "./validateAi";

/**
 * Extensión IA — llama a un modelo (GPT, Gemini u OpenRouter), guarda la
 * respuesta en una variable y opcionalmente clasifica la intención (una salida
 * por intención, más respaldo y error).
 *
 * No es un agente ni el AI Sales Engine. `executable: false`: falta `AiProvider`.
 */
export const aiExtensionTool: ToolDefinition = {
  type: "ai",
  label: "Extensión IA",
  description: "Procesamiento inteligente",
  defaultContentText: "Nodo encapsulado opcional",
  editorTitle: "Editar extensión encapsulada",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultContent: {},
  defaultConfig: { ...AI_DEFAULT_CONFIG },
  outputs: aiOutputs,
  summarize: summarizeAi,
  validate: validateAi,
  colors: {
    header: "#7c3aed",
    body: "#6d28d9",
    gradient: "linear-gradient(135deg,#a78bfa,#6d28d9)"
  },
  glyph: "✦"
};
