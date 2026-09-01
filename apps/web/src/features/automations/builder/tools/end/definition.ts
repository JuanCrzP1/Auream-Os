import type { ToolDefinition } from "../ToolDefinition";

/**
 * Finalizar — nodo de SISTEMA. `availableInPalette: false`.
 *
 * No se ofrece al usuario, pero no puede desaparecer del modelo: es el único
 * nodo terminal del grafo. `validateNodeDegree` exige un edge saliente a todo
 * tipo salvo éste, y `EndNodeHandler` es lo único que devuelve
 * `executionStatus: "completed"`. Sin él, ningún flow podría cerrarse ni
 * publicarse.
 *
 * Se mantiene su definición visual porque un flow ya guardado puede contenerlo
 * y el canvas debe seguir pintándolo correctamente.
 *
 * Deja de ser nodo de sistema el día que una herramienta del producto asuma la
 * terminación del flujo (candidatas: Venta aprobada, Notificación).
 */
export const endTool: ToolDefinition = {
  type: "end",
  label: "Finalizar",
  description: "Cierra el flujo",
  defaultContentText: "Cerrar rama del flujo",
  editorTitle: "Editar cierre",
  availableInPalette: false,
  terminal: true,
  executable: true,
  defaultConfig: {},
  colors: {
    header: "#16a34a",
    body: "#15803d",
    gradient: "linear-gradient(135deg,#4ade80,#15803d)"
  },
  glyph: "✓"
};
