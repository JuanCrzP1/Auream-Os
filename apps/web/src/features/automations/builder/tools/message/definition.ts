import { MESSAGE_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeMessage } from "./summarizeMessage";
import { releaseMessageResources } from "./releaseMessageResources";
import { duplicateMessageConfig } from "./duplicateMessageConfig";

/**
 * Mensaje — envía una secuencia de contenidos y continúa el flujo.
 *
 * El motor emite un mensaje por cada bloque de texto, en orden. Los medios se
 * guardan y se muestran, pero aún no se envían (no hay almacenamiento ni un
 * `OutboundMessage` que los transporte).
 */
export const messageTool: ToolDefinition = {
  ...MESSAGE_BLOCK,
  description: "Envía texto o media",
  defaultContentText: "Mensaje al usuario",
  editorTitle: "Editar mensaje",
  executable: true,
  summarize: summarizeMessage,
  duplicateConfig: duplicateMessageConfig,
  releaseResources: releaseMessageResources,
  colors: {
    header: "#3b82f6",
    body: "#2563eb",
    gradient: "linear-gradient(135deg,#60a5fa,#2563eb)"
  },
  glyph: "💬"
};
