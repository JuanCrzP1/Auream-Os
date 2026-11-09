import { readEnum, readString } from "./ConfigReaders";
import { COUNTRIES } from "./Countries";

// ---------------------------------------------------------------------------
// Notificación — contrato compartido por el builder (editor) y el motor
// (NotificationNodeHandler). Como en Leona: un aviso por WhatsApp a un número
// del equipo (no al cliente), enviado por el MISMO número conectado que
// atiende el chat. El mensaje admite variables del contacto y del flujo.
// ---------------------------------------------------------------------------

export interface NotificationConfig {
  /** Nombre del destinatario, para reconocerlo en el flujo. */
  readonly name: string;
  /** Prefijo del país, sin «+». */
  readonly countryCode: string;
  /** Solo dígitos, sin prefijo de país. */
  readonly phone: string;
  /** Admite variables. */
  readonly message: string;
}

/** Prefijos telefónicos de los países en que opera Auream (sin repetir). */
export const NOTIFICATION_DIAL_CODES: ReadonlyArray<string> = [...new Set(COUNTRIES.map((country) => country.dial))];

export const NOTIFICATION_PHONE_DIGITS = { min: 7, max: 15 } as const;

export const NOTIFICATION_DEFAULT_CONFIG: NotificationConfig = {
  name: "",
  countryCode: "57",
  phone: "",
  message: "Nuevo contacto: {full_name} ({phone})"
};

export function readNotificationConfig(config: Readonly<Record<string, unknown>>): NotificationConfig {
  return {
    name: readString(config.name),
    countryCode: readEnum(config.countryCode, NOTIFICATION_DIAL_CODES, "57"),
    phone: readString(config.phone).replace(/\D/g, ""),
    message: readString(config.message)
  };
}

/** El número completo (prefijo + número) o `null` si no es válido. */
export function notificationRecipientPhone(config: NotificationConfig): string | null {
  const { min, max } = NOTIFICATION_PHONE_DIGITS;
  return config.phone.length >= min && config.phone.length <= max ? `${config.countryCode}${config.phone}` : null;
}
