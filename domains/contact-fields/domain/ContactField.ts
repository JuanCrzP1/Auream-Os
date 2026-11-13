import {
  CONTACT_FIELD_LIMITS as LIMITS,
  CONTACT_FIELD_TYPES,
  RESERVED_FIELD_KEYS,
  foldFieldText as fold,
  keyFromLabel,
  type ContactFieldType
} from "../../../contracts/ContactFieldContracts";

// La web arma la clave mientras escribes el nombre con la MISMA regla.
export { foldFieldText as fold, keyFromLabel } from "../../../contracts/ContactFieldContracts";
import { CONTACT_FIELD_KEY_PATTERN, MAX_CONTACT_FIELD_TEXT, type ContactFieldValue } from "../../../contracts/ContactContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Un campo del cliente: sus reglas (nombre, clave, tipo, opciones) y cómo se
// convierte a su tipo lo que guarda un bloque. Puro: sin base ni red.
// ---------------------------------------------------------------------------

export interface FieldShape {
  readonly key: string;
  readonly label: string;
  readonly type: ContactFieldType;
  readonly options: ReadonlyArray<string>;
}

/** Un nombre legible para una clave que ya existe: `fecha_ultimo_pago` → «Fecha ultimo pago». */
export function labelFromKey(key: string): string {
  const words = key.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, LIMITS.maxLabel);
}

function requireLabel(value: unknown): string {
  const label = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!label) throw new ValidationError("Ponle un nombre al campo (p. ej. «Ciudad»).");
  if (label.length > LIMITS.maxLabel) throw new ValidationError(`El nombre admite hasta ${LIMITS.maxLabel} caracteres.`);
  return label;
}

/** La clave: la que llega (de un dato que ya existe) o la que sale del nombre. Nunca una del sistema. */
function requireKey(value: unknown, label: string): string {
  const key = typeof value === "string" && value.trim() ? value.trim() : keyFromLabel(label);
  if (!key || !CONTACT_FIELD_KEY_PATTERN.test(key) || key.length > 64) {
    throw new ValidationError("La clave solo admite letras, números, «_», «-» y «.», y debe empezar con una letra.");
  }
  if (RESERVED_FIELD_KEYS.has(key.toLowerCase())) throw new ValidationError(`«{${key}}» ya lo llena Auream: elige otro nombre.`);
  return key;
}

function requireType(value: unknown): ContactFieldType {
  if (typeof value === "string" && (CONTACT_FIELD_TYPES as ReadonlyArray<string>).includes(value)) return value as ContactFieldType;
  throw new ValidationError("Elige el tipo: texto, número, fecha, sí o no, o lista.");
}

function requireOptions(type: ContactFieldType, value: unknown): string[] {
  if (type !== "list") return [];
  const raw = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const options: string[] = [];
  for (const item of raw.map((entry) => entry.replace(/\s+/g, " ").trim()).filter(Boolean)) {
    if (item.length > LIMITS.maxOption) throw new ValidationError(`Cada opción admite hasta ${LIMITS.maxOption} caracteres.`);
    if (!options.some((existing) => fold(existing) === fold(item))) options.push(item);
  }
  if (options.length < LIMITS.minOptions) throw new ValidationError(`Una lista necesita al menos ${LIMITS.minOptions} opciones.`);
  if (options.length > LIMITS.maxOptions) throw new ValidationError(`Una lista admite hasta ${LIMITS.maxOptions} opciones.`);
  return options;
}

/** Un campo nuevo, validado. */
export function requireNewField(input: { readonly label?: unknown; readonly key?: unknown; readonly type?: unknown; readonly options?: unknown }): FieldShape {
  const label = requireLabel(input.label);
  const type = requireType(input.type);
  return { key: requireKey(input.key, label), label, type, options: requireOptions(type, input.options) };
}

/** Cambios a un campo que existe: la clave no cambia (los flujos la usan). */
export function requireFieldChanges(current: FieldShape, input: { readonly label?: unknown; readonly type?: unknown; readonly options?: unknown }): FieldShape {
  const label = input.label === undefined ? current.label : requireLabel(input.label);
  const type = input.type === undefined ? current.type : requireType(input.type);
  const options = input.options === undefined && type === current.type ? current.options : requireOptions(type, input.options ?? current.options);
  return { key: current.key, label, type, options };
}

// --- Convertir lo que guarda un bloque a su tipo ------------------------------

const TRUE = new Set(["si", "sí", "yes", "true", "1", "verdadero", "s"]);
const FALSE = new Set(["no", "false", "0", "falso", "n"]);

function parseNumber(raw: string): number | undefined {
  let text = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(text)) return undefined;
  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    text = /,\d{1,2}$/.test(text) && text.split(",").length === 2 ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function parseDate(raw: string): string | undefined {
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : local ? [Number(local[3]!.length === 2 ? `20${local[3]}` : local[3]), Number(local[2]), Number(local[1])] : null;
  if (!parts) return undefined;
  const [year, month, day] = parts as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Lo que guardó un bloque, convertido al tipo del campo. `undefined` si no
 * encaja (una lista que no tiene esa opción, una fecha que no existe): así no
 * se guarda basura en el cliente.
 */
export function coerceFieldValue(field: FieldShape, raw: unknown): ContactFieldValue | undefined {
  if (raw === null || raw === undefined) return undefined;
  const text = typeof raw === "string" ? raw.trim() : typeof raw === "number" || typeof raw === "boolean" ? String(raw) : "";
  if (!text) return undefined;
  switch (field.type) {
    case "text":
      return text.slice(0, MAX_CONTACT_FIELD_TEXT);
    case "number":
      return typeof raw === "number" && Number.isFinite(raw) ? raw : parseNumber(text);
    case "date":
      return parseDate(text);
    case "boolean":
      return typeof raw === "boolean" ? raw : TRUE.has(fold(text)) ? true : FALSE.has(fold(text)) ? false : undefined;
    case "list":
      return field.options.find((option) => fold(option) === fold(text));
  }
}
