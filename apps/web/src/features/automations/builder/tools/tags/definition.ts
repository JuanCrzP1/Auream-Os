import { TAGS_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeTags } from "./summarizeTags";

/**
 * Etiquetas — agrega o quita etiquetas del contacto (todas en un mismo bloque).
 *
 * Lo ejecuta `TagsNodeHandler` sobre el directorio de contactos: las
 * etiquetas que no existan en el catálogo de la cuenta se crean al agregarlas.
 */
export const tagsTool: ToolDefinition = {
  ...TAGS_BLOCK,
  description: "Agrega o administra etiquetas",
  defaultContentText: "Etiquetas del contacto",
  editorTitle: "Editar etiquetas",
  executable: true,
  summarize: summarizeTags,
  colors: {
    header: "#059669",
    body: "#047857",
    gradient: "linear-gradient(135deg,#34d399,#047857)"
  },
  glyph: "🏷"
};
