import type { ToolDefinition } from "../ToolDefinition";

/**
 * Intervalo — pausa la ejecución y la reanuda más tarde.
 *
 * La reanudación real depende de una cola que todavía no existe: hoy una sesión
 * que alcanza este nodo queda en estado `delayed` y nada la retoma.
 */
export const intervalTool: ToolDefinition = {
  type: "delay",
  label: "Intervalo",
  description: "Pausa antes de continuar",
  defaultContentText: "Reanudar más tarde",
  editorTitle: "Editar espera",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultConfig: {},
  colors: {
    header: "#0891b2",
    body: "#0e7490",
    gradient: "linear-gradient(135deg,#22d3ee,#0e7490)"
  },
  glyph: "⏱"
};
