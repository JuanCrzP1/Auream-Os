import type { ToolDefinition } from "../ToolDefinition";

/**
 * Finalizar — nodo de SISTEMA. `availableInPalette: false`.
 *
 * No se ofrece al usuario. Un flujo puede terminar en cualquier bloque (una
 * salida sin conectar termina la rama limpiamente); `end` se conserva porque
 * los flujos guardados pueden contenerlo y `EndNodeHandler` lo ejecuta.
 *
 * Se mantiene su definición visual porque un flow ya guardado puede contenerlo
 * y el canvas debe seguir pintándolo correctamente.
 *
 * Deja de ser nodo de sistema el día que una herramienta del producto asuma la
 * terminación del flujo (candidata: Notificación).
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
    header: "#3f6212",
    body: "#365314",
    gradient: "linear-gradient(135deg,#65a30d,#365314)"
  },
  glyph: "✓"
};
