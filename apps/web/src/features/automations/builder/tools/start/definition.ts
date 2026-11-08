import { START_NODE_NAME, START_NODE_TYPE } from "@contracts/FlowEntry";
import type { ToolDefinition } from "../ToolDefinition";

/**
 * Inicio — nodo de SISTEMA. Todo flujo tiene exactamente uno: es su
 * `entryNodeId`. No está en la paleta, no se borra ni se duplica, no se
 * configura y tiene una sola salida. Ver `contracts/FlowEntry.ts`.
 *
 * Aquí vivirán los disparadores del flujo (palabras clave, anuncios…).
 */
export const startTool: ToolDefinition = {
  type: START_NODE_TYPE,
  label: START_NODE_NAME,
  description: "Donde empieza el flujo",
  defaultContentText: "",
  defaultContent: {},
  editorTitle: "Inicio del flujo",
  availableInPalette: false,
  terminal: false,
  executable: true,
  defaultConfig: {},
  colors: {
    header: "#6c5ce7",
    body: "#5b47d6",
    gradient: "linear-gradient(135deg,#6c5ce7,#9333ea)"
  },
  glyph: "▶"
};
