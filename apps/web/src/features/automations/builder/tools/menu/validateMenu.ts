import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";
import { MENU_LIMITS, readMenuConfig } from "./menuConfig";

export const MISSING_MESSAGE_MESSAGE = "Escribe el mensaje del menú.";
export const NO_OPTIONS_MESSAGE = "Añade al menos una opción.";
export const EMPTY_OPTION_MESSAGE = "Cada opción necesita un título.";
export const DUPLICATE_OPTION_MESSAGE = "Hay dos opciones con el mismo título.";
export const TOO_MANY_OPTIONS_MESSAGE = "Hay más opciones de las que permite WhatsApp para este formato.";
export const TITLE_TOO_LONG_MESSAGE = "Algún título supera el máximo de caracteres de WhatsApp.";
export const MISSING_BUTTON_LABEL_MESSAGE = "Escribe el texto del botón que abre la lista.";

export function validateMenu(_content: ToolData, config: ToolData): ValidationResult {
  const read = readMenuConfig(config);
  const limits = MENU_LIMITS[read.format];

  if (read.message.trim().length === 0) return invalid(MISSING_MESSAGE_MESSAGE);
  if (read.format === "list" && read.buttonLabel.trim().length === 0) return invalid(MISSING_BUTTON_LABEL_MESSAGE);
  if (read.options.length === 0) return invalid(NO_OPTIONS_MESSAGE);
  if (read.options.length > limits.maxOptions) return invalid(TOO_MANY_OPTIONS_MESSAGE);

  const titles = read.options.map((option) => option.title.trim().toLowerCase());
  if (titles.some((title) => title.length === 0)) return invalid(EMPTY_OPTION_MESSAGE);
  if (new Set(titles).size !== titles.length) return invalid(DUPLICATE_OPTION_MESSAGE);
  if (read.options.some((option) => option.title.trim().length > limits.maxTitle)) return invalid(TITLE_TOO_LONG_MESSAGE);

  return VALID;
}
