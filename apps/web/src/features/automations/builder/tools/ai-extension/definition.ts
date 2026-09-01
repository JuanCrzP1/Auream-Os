import type { ToolDefinition } from "../ToolDefinition";

/**
 * Extensión IA — nodo de procesamiento con un proveedor de IA.
 *
 * NO es el AI Sales Engine ni un agente: es un tipo de nodo del grafo, y el
 * flujo sigue siendo determinístico. Hoy no existe implementación de
 * `AiProvider`, así que el nodo falla explícitamente en ejecución.
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
  defaultConfig: {},
  colors: {
    header: "#9333ea",
    body: "#7e22ce",
    gradient: "linear-gradient(135deg,#c084fc,#7e22ce)"
  },
  glyph: "✦"
};
