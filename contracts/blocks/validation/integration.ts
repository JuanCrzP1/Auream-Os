import { VALID, invalid, type BlockData, type BlockCheck } from "../BlockRules";
import { CONTACT_FIELD_KEY_PATTERN } from "../../ContactContracts";
import { readIntegrationConfig } from "../../IntegrationConfig";

export const INVALID_URL_MESSAGE = "La URL debe empezar por http:// o https:// (puede llevar variables).";
export const EMPTY_HEADER_MESSAGE = "Cada cabecera necesita un nombre.";
export const INCOMPLETE_MAPPING_MESSAGE = "Completa la ruta y el campo de cada dato a guardar.";
export const INVALID_FIELD_MESSAGE = "El nombre de un campo solo puede tener letras, números, «_» y «.» (sin espacios ni tildes).";

export function validateIntegration(_content: BlockData, config: BlockData): BlockCheck {
  const read = readIntegrationConfig(config);

  if (!/^https?:\/\/\S+$/i.test(read.url)) return invalid(INVALID_URL_MESSAGE);
  if (read.headers.some((header) => header.key.trim().length === 0)) return invalid(EMPTY_HEADER_MESSAGE);
  if (read.responseMappings.some((m) => m.path.trim().length === 0 || m.field.trim().length === 0)) {
    return invalid(INCOMPLETE_MAPPING_MESSAGE);
  }
  if (read.responseMappings.some((m) => !CONTACT_FIELD_KEY_PATTERN.test(m.field.trim()))) return invalid(INVALID_FIELD_MESSAGE);

  return VALID;
}
