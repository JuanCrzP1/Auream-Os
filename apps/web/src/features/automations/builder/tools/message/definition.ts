import type { ToolDefinition } from "../ToolDefinition";
import { summarizeMessage } from "./summarizeMessage";
import { releaseMessageResources } from "./releaseMessageResources";
import { validateMessageContent } from "./validateMessageContent";
import { duplicateMessageConfig } from "./duplicateMessageConfig";

/**
 * Mensaje — envía una secuencia de contenidos y continúa el flujo.
 *
 * El motor emite un mensaje por cada bloque de texto, en orden. Los medios se
 * guardan y se muestran, pero aún no se envían (no hay almacenamiento ni un
 * `OutboundMessage` que los transporte).
 */
export const messageTool: ToolDefinition = {
  type: "message",
  label: "Mensaje",
  description: "Envía texto o media",
  defaultContentText: "Mensaje al usuario",
  // Nace sin `content.text`: su contenido es `config.items`.
  defaultContent: {},
  editorTitle: "Editar mensaje",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultConfig: { items: [] },
  summarize: summarizeMessage,
  validate: validateMessageContent,
  duplicateConfig: duplicateMessageConfig,
  releaseResources: releaseMessageResources,
  colors: {
    header: "#3b82f6",
    body: "#2563eb",
    gradient: "linear-gradient(135deg,#60a5fa,#2563eb)"
  },
  glyph: "💬"
};
