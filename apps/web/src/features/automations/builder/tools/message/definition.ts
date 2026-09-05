import type { ToolDefinition } from "../ToolDefinition";
import { summarizeMessage } from "./summarizeMessage";
import { releaseMessageResources } from "./releaseMessageResources";
import { validateMessageContent } from "./validateMessageContent";
import { duplicateMessageConfig } from "./duplicateMessageConfig";

/**
 * Mensaje — envía una secuencia de contenidos al usuario y continúa el flujo.
 *
 * Su configuración es `config.items`: una secuencia ordenada. El motor emite un
 * mensaje por cada contenido de texto, en orden. Los contenidos de medios se
 * guardan y se muestran, pero todavía no se envían — no hay almacenamiento ni
 * un `OutboundMessage` capaz de transportarlos.
 */
export const messageTool: ToolDefinition = {
  summarize: summarizeMessage,
  validateContent: validateMessageContent,
  duplicateConfig: duplicateMessageConfig,
  releaseResources: releaseMessageResources,
  type: "message",
  label: "Mensaje",
  description: "Envía texto o media",
  defaultContentText: "Mensaje al usuario",
  // Nace SIN `content.text`. Su contenido es `config.items`, y un `text`
  // heredado ahí sería la misma información en dos sitios desde el primer día.
  // El lector sigue aceptándolo para no romper los nodos ya guardados, pero
  // ninguno nuevo lo trae.
  defaultContent: {},
  editorTitle: "Editar mensaje",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultConfig: { items: [] },
  colors: {
    header: "#2563eb",
    body: "#1d4ed8",
    gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)"
  },
  glyph: "💬"
};
