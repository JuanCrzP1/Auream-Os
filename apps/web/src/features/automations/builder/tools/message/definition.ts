import type { ToolDefinition } from "../ToolDefinition";

/** Mensaje — envía contenido al usuario y continúa el flujo. */
export const messageTool: ToolDefinition = {
  type: "message",
  label: "Mensaje",
  description: "Envía texto o media",
  defaultContentText: "Mensaje al usuario",
  editorTitle: "Editar mensaje",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultConfig: {},
  colors: {
    header: "#2563eb",
    body: "#1d4ed8",
    gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)"
  },
  glyph: "💬"
};
