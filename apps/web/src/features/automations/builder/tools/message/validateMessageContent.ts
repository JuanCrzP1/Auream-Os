import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";
import type { MessageItem } from "./types";
import { readMessageItems } from "./readMessageConfig";
import { isUsableUrl } from "./mediaSource";

export const NO_CONTENT_MESSAGE = "Agrega al menos un contenido para enviar antes de guardar.";

export const MISSING_SOURCE_MESSAGE = "Sube el archivo o escribe el enlace de cada imagen, video, audio o documento.";

/** Texto del preview cuando el cliente no recibiría nada. */
export const EMPTY_PREVIEW_TEXT = "Sin contenido para enviar";

/** Bloques que el cliente recibe. Una pausa no lo es. */
export function isContentItem(item: MessageItem): boolean {
  return item.kind !== "interval";
}

/**
 * ¿Tiene de dónde sacar lo que envía? Un texto se sostiene solo (aunque esté
 * vacío: regla acordada). Un medio necesita una URL usable: un enlace escrito
 * o un archivo ya SUBIDO. Un archivo elegido que no se subió no se puede
 * enviar (sus bytes no están guardados en ningún lado).
 */
function hasSource(item: MessageItem): boolean {
  if (item.kind === "interval") return false;
  if (item.kind === "text") return true;

  return isUsableUrl(item.url);
}

/**
 * ¿Puede guardarse este Mensaje?
 *
 * Exige que TODOS los bloques de contenido tengan fuente: un medio sin archivo
 * ni enlace junto a un texto válido se enviaría a medias.
 */
export function validateMessageContent(content: ToolData, config: ToolData): ValidationResult {
  const blocks = readMessageItems(config, content).filter(isContentItem);

  if (blocks.length === 0) return invalid(NO_CONTENT_MESSAGE);
  if (!blocks.every(hasSource)) return invalid(MISSING_SOURCE_MESSAGE);

  return VALID;
}
