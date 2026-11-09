// Las reglas de validación del bloque son compartidas (editor web y MCP): viven en `contracts/blocks`.
export { MISSING_SOURCE_MESSAGE, NO_CONTENT_MESSAGE, isContentItem, validateMessageContent } from "@contracts/blocks/validation/message";

/** Texto del preview cuando el cliente no recibiría nada. */
export const EMPTY_PREVIEW_TEXT = "Sin contenido para enviar";
