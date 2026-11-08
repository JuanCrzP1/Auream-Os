import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";
import { readPixelConfig } from "./pixelConfig";

export const MISSING_PIXEL_MESSAGE = "Elige el píxel de Meta que recibe el evento.";
export const MISSING_VALUE_MESSAGE = "Indica el valor de la compra (un número o una variable).";

export function validatePixel(_content: ToolData, config: ToolData): ValidationResult {
  const read = readPixelConfig(config);

  if (!read.connectionId) return invalid(MISSING_PIXEL_MESSAGE);
  if (read.event === "purchase" && read.value.trim().length === 0) return invalid(MISSING_VALUE_MESSAGE);

  return VALID;
}
