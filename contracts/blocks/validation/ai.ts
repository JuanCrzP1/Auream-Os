import { VALID, invalid, type BlockData, type BlockCheck } from "../BlockRules";
import { AI_MAX_INTENTS, readAiConfig } from "../../AiConfig";

export const MISSING_CREDENTIAL_MESSAGE = "Elige la conexión de IA que usará el bloque.";
export const MISSING_MODEL_MESSAGE = "Elige el modelo de IA.";
export const MISSING_USER_MESSAGE = "Indica qué mensaje recibe la IA (por ejemplo {last_message}).";
export const MISSING_VARIABLE_MESSAGE = "Indica en qué variable se guarda la respuesta.";
export const INCOMPLETE_INTENT_MESSAGE = "Cada intención necesita una descripción y un nombre de salida.";
export const DUPLICATE_INTENT_MESSAGE = "Dos intenciones tienen el mismo nombre de salida.";
export const TOO_MANY_INTENTS_MESSAGE = `Puedes definir hasta ${AI_MAX_INTENTS} intenciones.`;
export const INVALID_KEY_MESSAGE = "Los nombres de salida solo admiten letras, números, guion y guion bajo.";

const KEY = /^[A-Za-z0-9_-]+$/;

export function validateAi(_content: BlockData, config: BlockData): BlockCheck {
  const read = readAiConfig(config);

  if (!read.credentialId) return invalid(MISSING_CREDENTIAL_MESSAGE);
  if (!read.model) return invalid(MISSING_MODEL_MESSAGE);
  if (read.userMessage.trim().length === 0) return invalid(MISSING_USER_MESSAGE);
  if (read.responseVariable.length === 0) return invalid(MISSING_VARIABLE_MESSAGE);
  if (read.intents.length > AI_MAX_INTENTS) return invalid(TOO_MANY_INTENTS_MESSAGE);

  const keys = [...read.intents.map((intent) => intent.key), ...(read.intents.length > 0 ? [read.fallbackKey] : [])];
  if (read.intents.some((intent) => intent.description.trim().length === 0 || intent.key.length === 0)) {
    return invalid(INCOMPLETE_INTENT_MESSAGE);
  }
  if (keys.some((key) => !KEY.test(key))) return invalid(INVALID_KEY_MESSAGE);
  if (new Set(keys.map((key) => key.toLowerCase())).size !== keys.length) return invalid(DUPLICATE_INTENT_MESSAGE);

  return VALID;
}
