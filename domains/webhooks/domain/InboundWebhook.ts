import { CONTACT_FIELD_KEY_PATTERN } from "../../../contracts/ContactContracts";
import { WEBHOOK_LIMITS, type WebhookMapping } from "../../../contracts/WebhookContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Webhook de entrada (dominio): la dirección secreta de una cuenta, su número
// opcional para iniciar flujos y su mapeo. Reglas puras: validar, leer un dato
// del envío por su ruta y normalizar el teléfono.
// ---------------------------------------------------------------------------

export interface InboundWebhook {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly connectionId: string | null;
  /** El secreto de la dirección, cifrado (se descifra para mostrar la URL y comparar). */
  readonly secretEnvelope: string;
  readonly mapping: WebhookMapping;
  readonly sample: unknown;
  readonly sampleReceivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Contexto del cifrado del secreto: un sobre de un webhook no sirve para otro. */
export function webhookSecretContext(tenantId: string, webhookId: string): string {
  return `inbound-webhook:${tenantId}:${webhookId}`;
}

export function requireWebhookName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new ValidationError("Ponle un nombre al webhook.");
  if (name.length > WEBHOOK_LIMITS.name) throw new ValidationError(`El nombre admite hasta ${WEBHOOK_LIMITS.name} caracteres.`);
  return name;
}

const PATH = /^[^\s]{1,200}$/;

function requirePath(path: string, label: string): void {
  if (path && !PATH.test(path)) throw new ValidationError(`La ruta de «${label}» no es válida (sin espacios, hasta ${WEBHOOK_LIMITS.path} caracteres).`);
}

/** Un mapeo coherente: rutas válidas, campos con nombre de campo válido, límites. */
export function requireWebhookMapping(mapping: WebhookMapping): WebhookMapping {
  requirePath(mapping.phonePath, "Teléfono");
  requirePath(mapping.namePath, "Nombre");
  requirePath(mapping.emailPath, "Correo");
  if (!/^\d{1,4}$/.test(mapping.defaultCountryCode)) throw new ValidationError("El prefijo del país no es válido.");
  if (mapping.fields.length > WEBHOOK_LIMITS.fields) throw new ValidationError(`Hasta ${WEBHOOK_LIMITS.fields} campos por webhook.`);
  for (const field of mapping.fields) {
    if (!CONTACT_FIELD_KEY_PATTERN.test(field.key)) throw new ValidationError(`«${field.key || "(vacío)"}» no es un nombre de campo válido: letras, números, punto, guion y guion bajo.`);
    if (!field.path) throw new ValidationError(`Elige de dónde sale el campo «${field.key}».`);
    requirePath(field.path, field.key);
  }
  if (new Set(mapping.fields.map((field) => field.key)).size !== mapping.fields.length) throw new ValidationError("Hay campos repetidos en el mapeo.");
  if (mapping.addTags.length > WEBHOOK_LIMITS.tags || mapping.removeTags.length > WEBHOOK_LIMITS.tags) throw new ValidationError(`Hasta ${WEBHOOK_LIMITS.tags} etiquetas por lista.`);
  return mapping;
}

/** El valor en `path` (`data.buyer.phone`, `items.0.name`); `undefined` si no existe. */
export function readPath(payload: unknown, path: string): unknown {
  if (!path) return undefined;
  let current: unknown = payload;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Texto de un dato simple (texto, número o sí/no); `null` si no hay o es un objeto. */
export function readText(payload: unknown, path: string): string | null {
  const value = readPath(payload, path);
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "sí" : "no";
  return null;
}

/**
 * Teléfono completo (solo dígitos, con prefijo de país) o `null`. Ignora
 * espacios, guiones, paréntesis y «+»; «00» al inicio es el prefijo
 * internacional. Un número local (hasta 10 dígitos) recibe el prefijo por
 * defecto. Se compara el número COMPLETO (no los últimos dígitos, como
 * Leona): dos clientes de países distintos nunca se confunden.
 */
export function normalizePhone(raw: string | null, defaultCountryCode: string): string | null {
  if (!raw) return null;
  const international = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) return valid(digits.slice(2));
  if (international) return valid(digits);
  // Formato local con «0» de larga distancia (Venezuela, Perú…): 0412… → 412…
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length >= 7 && digits.length <= 10) digits = `${defaultCountryCode}${digits}`;
  return valid(digits);
}

function valid(digits: string): string | null {
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
