import type { ToolDefinition } from "../ToolDefinition";

/**
 * Integración — invoca un efecto externo: webhook, API de dominio, CRM.
 *
 * Se llamó «Acción» (tipo `action`). Es la misma herramienta con el nombre del
 * producto. El ejecutor de efectos externos todavía no existe: el nodo falla
 * explícitamente en ejecución en lugar de simular un resultado.
 */
export const integrationTool: ToolDefinition = {
  type: "integration",
  label: "Integración",
  description: "Conecta servicios externos",
  defaultContentText: "Webhook o API de dominio",
  editorTitle: "Editar integración",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultConfig: {},
  colors: {
    header: "#dc2626",
    body: "#b91c1c",
    gradient: "linear-gradient(135deg,#ef4444,#b91c1c)"
  },
  glyph: "⚡"
};
