import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";
import { readIntegrationConfig } from "./integrationConfig";

export const INVALID_URL_MESSAGE = "La URL debe empezar por http:// o https:// (puede llevar variables).";
export const EMPTY_HEADER_MESSAGE = "Cada cabecera necesita un nombre.";
export const INCOMPLETE_MAPPING_MESSAGE = "Completa la ruta y el campo de cada dato a guardar.";

export function validateIntegration(_content: ToolData, config: ToolData): ValidationResult {
  const read = readIntegrationConfig(config);

  if (!/^https?:\/\/\S+$/i.test(read.url)) return invalid(INVALID_URL_MESSAGE);
  if (read.headers.some((header) => header.key.trim().length === 0)) return invalid(EMPTY_HEADER_MESSAGE);
  if (read.responseMappings.some((m) => m.path.trim().length === 0 || m.field.trim().length === 0)) {
    return invalid(INCOMPLETE_MAPPING_MESSAGE);
  }

  return VALID;
}
