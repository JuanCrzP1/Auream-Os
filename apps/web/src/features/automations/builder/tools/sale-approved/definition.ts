import type { ToolDefinition } from "../ToolDefinition";

/**
 * Venta aprobada — marca la conversación como venta cerrada.
 *
 * `executable: false`. No existe modelo de venta ni dónde persistirla, y hasta
 * que exista este nodo no puede hacer nada real.
 *
 * NO es un nodo terminal: registrar una venta no cierra el flujo — después
 * suele haber confirmación, etiquetado o notificación. La terminación del grafo
 * sigue siendo responsabilidad del nodo de sistema `end`.
 */
export const saleApprovedTool: ToolDefinition = {
  type: "sale-approved",
  label: "Venta aprobada",
  description: "Detecta una venta aprobada",
  defaultContentText: "Registro de venta",
  editorTitle: "Editar venta aprobada",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultConfig: {},
  colors: {
    header: "#15803d",
    body: "#166534",
    gradient: "linear-gradient(135deg,#4ade80,#166534)"
  },
  glyph: "💰"
};
