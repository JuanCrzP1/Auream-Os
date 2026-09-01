import type { ToolDefinition } from "../ToolDefinition";

/**
 * Menú — ofrece un conjunto de opciones y espera la elección del usuario.
 *
 * `executable: false`. Falta acordar la pieza clave: cómo se enruta cada opción
 * hacia un edge concreto. Hoy el recorrido lo decide `EdgeEvaluator` por
 * condición y prioridad, y un menú necesita una correspondencia opción → salida
 * que ese modelo todavía no expresa.
 *
 * `defaultConfig.options` nace como lista vacía: que un menú tiene opciones es
 * lo único que su nombre determina sin ambigüedad.
 */
export const menuTool: ToolDefinition = {
  type: "menu",
  label: "Menú",
  description: "Ofrece opciones al usuario",
  defaultContentText: "Opciones para el usuario",
  editorTitle: "Editar menú",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultConfig: { options: [] },
  colors: {
    header: "#4f46e5",
    body: "#4338ca",
    gradient: "linear-gradient(135deg,#818cf8,#4338ca)"
  },
  glyph: "☰"
};
