import type { AdOrigin } from "../../../contracts/AdOrigin";
import { CONTACT_FIELD_KEY_PATTERN, MAX_CONTACT_FIELD_TEXT, type ContactFieldValue } from "../../../contracts/ContactContracts";

/** Un contacto de una cuenta. Su identidad es (canal, clave externa). */
export interface Contact {
  readonly id: string;
  readonly tenantId: string;
  readonly channel: string;
  readonly externalKey: string;
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly customFields: Readonly<Record<string, ContactFieldValue>>;
  /** El último anuncio de clic a WhatsApp por el que entró (uso interno: variables, Pixel). */
  readonly adOrigin?: AdOrigin | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Clave externa canónica. En WhatsApp es el teléfono: solo dígitos, así
 * «+57 300 123 4567» y «573001234567» son el mismo contacto.
 */
export function normalizeExternalKey(channel: string, key: string): string {
  const trimmed = key.trim();
  return channel === "whatsapp" ? trimmed.replace(/\D/g, "") : trimmed;
}

/** Correo válido (forma básica) o `null`. */
export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (trimmed === "") return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/** Nombre de campo personalizado: letras, números, punto, guion y guion bajo (como Leona). */
export const CUSTOM_FIELD_KEY = CONTACT_FIELD_KEY_PATTERN;

export function isValidCustomFieldValue(value: unknown): value is ContactFieldValue {
  return (typeof value === "string" && value.length <= MAX_CONTACT_FIELD_TEXT) || (typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean";
}
