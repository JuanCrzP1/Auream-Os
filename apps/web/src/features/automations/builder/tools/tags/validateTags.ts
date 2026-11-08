import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";
import { readTagsConfig } from "./tagsConfig";

export const NO_TAGS_MESSAGE = "Elige al menos una etiqueta.";

export function validateTags(_content: ToolData, config: ToolData): ValidationResult {
  return readTagsConfig(config).tags.length > 0 ? VALID : invalid(NO_TAGS_MESSAGE);
}
