import type { ToolDefinition } from "../ToolDefinition";

/** Condicional — bifurca el flujo evaluando el contexto de la sesión. */
export const conditionalTool: ToolDefinition = {
  type: "condition",
  label: "Condicional",
  description: "Bifurca según condición",
  defaultContentText: "Preprocesamiento y flags",
  editorTitle: "Editar condición",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultConfig: {},
  colors: {
    header: "#7c3aed",
    body: "#6d28d9",
    gradient: "linear-gradient(135deg,#a855f7,#6d28d9)"
  },
  glyph: "⬡"
};
