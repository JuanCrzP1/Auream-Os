import { AI_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeAi } from "./summarizeAi";

/**
 * Extensión IA — llama a un modelo (OpenAI, Gemini u OpenRouter) con una
 * conexión de IA de la cuenta (clave cifrada, nunca en el flujo), guarda la
 * respuesta en una variable y opcionalmente clasifica la intención (una salida
 * por intención, más respaldo y error).
 *
 * No es un agente ni el AI Sales Engine. Lo ejecuta `AiNodeHandler`.
 */
export const aiExtensionTool: ToolDefinition = {
  ...AI_BLOCK,
  description: "Procesamiento inteligente",
  defaultContentText: "Nodo encapsulado opcional",
  editorTitle: "Editar extensión encapsulada",
  executable: true,
  summarize: summarizeAi,
  colors: {
    header: "#7c3aed",
    body: "#6d28d9",
    gradient: "linear-gradient(135deg,#a78bfa,#6d28d9)"
  },
  glyph: "✦"
};
