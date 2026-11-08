import {
  WAIT_RESPONSE_DEFAULT_CONFIG,
  WAIT_RESPONSE_OUTPUT,
  hasWaitResponseTimeout,
  readWaitResponseConfig
} from "@contracts/WaitResponseConfig";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeWaitResponse } from "./summarizeWaitResponse";
import { validateWaitResponse } from "./validateWaitResponse";

/**
 * Esperar respuesta — suspende el flujo hasta que el cliente contesta y, con
 * `config.targetKey`, guarda la respuesta en el contexto.
 *
 * Dos salidas: «Respuesta» y, si la espera tiene límite, «Tiempo agotado».
 */
export const waitResponseTool: ToolDefinition = {
  type: "question",
  label: "Esperar respuesta",
  description: "Aguarda input del usuario",
  defaultContentText: "Pregunta esperando input",
  // Sin mensaje previo: suele preguntarlo un Mensaje anterior.
  defaultContent: {},
  editorTitle: "Editar espera",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultConfig: { ...WAIT_RESPONSE_DEFAULT_CONFIG },
  outputs: (config) => [
    { id: WAIT_RESPONSE_OUTPUT.answer, label: "Respuesta" },
    ...(hasWaitResponseTimeout(readWaitResponseConfig(config))
      ? [{ id: WAIT_RESPONSE_OUTPUT.timeout, label: "Tiempo agotado" }]
      : [])
  ],
  summarize: summarizeWaitResponse,
  validate: validateWaitResponse,
  colors: {
    header: "#b68f25",
    body: "#8a6418",
    gradient: "linear-gradient(135deg,#e0b83f,#8a6418)"
  },
  glyph: "⏳"
};
