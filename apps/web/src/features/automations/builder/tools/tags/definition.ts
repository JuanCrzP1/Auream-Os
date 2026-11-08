import type { ToolDefinition } from "../ToolDefinition";
import { TAGS_DEFAULT_CONFIG } from "./tagsConfig";
import { summarizeTags } from "./summarizeTags";
import { validateTags } from "./validateTags";

/**
 * Etiquetas — agrega o quita etiquetas del contacto (todas en un mismo bloque).
 *
 * Lo ejecuta `TagsNodeHandler` sobre el directorio de contactos: las
 * etiquetas que no existan en el catálogo de la cuenta se crean al agregarlas.
 */
export const tagsTool: ToolDefinition = {
  type: "tags",
  label: "Etiquetas",
  description: "Agrega o administra etiquetas",
  defaultContentText: "Etiquetas del contacto",
  editorTitle: "Editar etiquetas",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultContent: {},
  defaultConfig: { ...TAGS_DEFAULT_CONFIG },
  summarize: summarizeTags,
  validate: validateTags,
  colors: {
    header: "#059669",
    body: "#047857",
    gradient: "linear-gradient(135deg,#34d399,#047857)"
  },
  glyph: "🏷"
};
