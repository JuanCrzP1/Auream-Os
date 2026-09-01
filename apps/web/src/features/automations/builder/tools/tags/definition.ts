import type { ToolDefinition } from "../ToolDefinition";

/**
 * Etiquetas — clasifica el contacto de la conversación.
 *
 * `executable: false`. El motor reconoce el tipo pero no sabe ejecutarlo: no
 * existe todavía el dominio `contacts` sobre el que una etiqueta se aplica.
 *
 * `defaultConfig.tags` nace como lista vacía porque la forma —un conjunto de
 * etiquetas— es lo único que el nombre de la herramienta determina sin
 * ambigüedad. Qué se hace con ellas es especificación pendiente.
 */
export const tagsTool: ToolDefinition = {
  type: "tags",
  label: "Etiquetas",
  description: "Agrega o administra etiquetas",
  defaultContentText: "Etiquetas del contacto",
  editorTitle: "Editar etiquetas",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultConfig: { tags: [] },
  colors: {
    header: "#059669",
    body: "#047857",
    gradient: "linear-gradient(135deg,#34d399,#047857)"
  },
  glyph: "🏷"
};
