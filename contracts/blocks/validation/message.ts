import { VALID, invalid, type BlockCheck, type BlockData } from "../BlockRules";
import { readMessageItems, type MessageItem } from "../../MessageConfig";

export const NO_CONTENT_MESSAGE = "Agrega al menos un contenido para enviar antes de guardar.";

export const MISSING_SOURCE_MESSAGE = "Sube el archivo o escribe el enlace (o una variable, como {portada}) de cada imagen, video, audio o documento.";

/** ¿Es un enlace http(s) utilizable para descargar el medio? */
export function isUsableMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  try {
    const { protocol } = new URL(trimmed);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Una variable entre llaves (`{kie.ai.result}`, `{portada|https://…}`): el enlace llega al enviar, como en Leona. */
const MEDIA_VARIABLE = /\{\s*[A-Za-z_][A-Za-z0-9_.-]*\s*(?:\|[^{}]*)?\}/;

/** ¿El enlace del medio lleva una variable? (p. ej. el resultado de Kie.ai o de una Integración). */
export function hasMediaVariable(url: string): boolean {
  return MEDIA_VARIABLE.test(url);
}

/** ¿Tiene de dónde sacar el medio? Un enlace http(s) o una variable que lo traerá al enviar. */
export function isMediaSource(url: string): boolean {
  return isUsableMediaUrl(url) || hasMediaVariable(url);
}

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
  return isMediaSource(item.url);
}

export function validateMessageContent(content: BlockData, config: BlockData): BlockCheck {
  const blocks = readMessageItems(config, content).filter(isContentItem);

  if (blocks.length === 0) return invalid(NO_CONTENT_MESSAGE);
  if (!blocks.every(hasSource)) return invalid(MISSING_SOURCE_MESSAGE);

  return VALID;
}
