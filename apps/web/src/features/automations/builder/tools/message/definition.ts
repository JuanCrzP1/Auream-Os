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
  // AZUL AUREAM, un escalón más cielo que antes. Header y gradient suben lo
  // que antes eran los tonos de body y de header respectivamente —el mismo
  // matiz, no uno nuevo—, así que sigue siendo identificable como el azul de
  // Mensaje y no se acerca al cyan de Intervalo (`#0891b2`). Fuente única:
  // ningún otro archivo del tool declara un hex propio.
  colors: {
    header: "#3b82f6",
    body: "#2563eb",
    gradient: "linear-gradient(135deg,#60a5fa,#2563eb)"
  },
  glyph: "💬"
};
