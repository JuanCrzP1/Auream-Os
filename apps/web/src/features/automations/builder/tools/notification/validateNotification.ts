import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";
import { NOTIFICATION_PHONE_DIGITS, readNotificationConfig } from "./notificationConfig";

export const MISSING_NAME_MESSAGE = "Indica a quién se avisa.";
export const INVALID_PHONE_MESSAGE = "Escribe un número de teléfono válido (entre 7 y 15 dígitos).";
export const MISSING_MESSAGE_MESSAGE = "Escribe el mensaje del aviso.";

export function validateNotification(_content: ToolData, config: ToolData): ValidationResult {
  const read = readNotificationConfig(config);

  if (read.name.trim().length === 0) return invalid(MISSING_NAME_MESSAGE);
  if (read.phone.length < NOTIFICATION_PHONE_DIGITS.min || read.phone.length > NOTIFICATION_PHONE_DIGITS.max) return invalid(INVALID_PHONE_MESSAGE);
  if (read.message.trim().length === 0) return invalid(MISSING_MESSAGE_MESSAGE);

  return VALID;
}
