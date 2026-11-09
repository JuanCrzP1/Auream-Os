import { WAIT_RESPONSE_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeWaitResponse } from "./summarizeWaitResponse";

/**
 * Esperar respuesta — suspende el flujo hasta que el cliente contesta y, con
 * `config.targetKey`, guarda la respuesta en el contexto.
 *
 * Dos salidas: «Respuesta» y, si la espera tiene límite, «Tiempo agotado».
 */
export const waitResponseTool: ToolDefinition = {
  ...WAIT_RESPONSE_BLOCK,
  description: "Aguarda input del usuario",
  defaultContentText: "Pregunta esperando input",
  editorTitle: "Editar espera",
  executable: true,
  summarize: summarizeWaitResponse,
  colors: {
    header: "#b68f25",
    body: "#8a6418",
    gradient: "linear-gradient(135deg,#e0b83f,#8a6418)"
  },
  glyph: "⏳"
};
