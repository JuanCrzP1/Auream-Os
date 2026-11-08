import type { ToolData } from "../ToolDefinition";
import { readEnum, readString } from "../_kit/read";
import { COUNTRY_CODE_VALUES } from "../_kit/catalogs";

/** Aviso por WhatsApp a un número del equipo (no al cliente). */
export interface NotificationConfig {
  /** Nombre del destinatario, para reconocerlo en el flujo. */
  readonly name: string;
  readonly countryCode: string;
  /** Solo dígitos, sin prefijo de país. */
  readonly phone: string;
  /** Admite variables del contacto. */
  readonly message: string;
}

export const NOTIFICATION_DEFAULT_CONFIG: NotificationConfig = {
  name: "",
  countryCode: "57",
  phone: "",
  message: "Nuevo contacto: {full_name} ({phone})"
};

export function readNotificationConfig(config: ToolData): NotificationConfig {
  return {
    name: readString(config.name),
    countryCode: readEnum(config.countryCode, COUNTRY_CODE_VALUES, "57"),
    phone: readString(config.phone).replace(/\D/g, ""),
    message: readString(config.message)
  };
}
