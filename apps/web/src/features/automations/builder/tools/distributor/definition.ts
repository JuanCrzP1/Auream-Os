import type { ToolDefinition } from "../ToolDefinition";

/**
 * Distribuidor — reparte la conversación entre varias rutas.
 *
 * `executable: false`. La política de reparto —round-robin, peso, sticky por
 * contacto, anti-repetición— no está decidida, y es precisamente lo que define
 * el comportamiento de esta herramienta.
 *
 * No confundir con Condicional: el condicional decide por el contenido del
 * contexto; el distribuidor reparte sin mirarlo.
 */
export const distributorTool: ToolDefinition = {
  type: "distributor",
  label: "Distribuidor",
  description: "Distribuye conversaciones",
  defaultContentText: "Reparto entre rutas",
  editorTitle: "Editar distribuidor",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultConfig: {},
  colors: {
    header: "#d97706",
    body: "#b45309",
    gradient: "linear-gradient(135deg,#fbbf24,#b45309)"
  },
  glyph: "🔀"
};
