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
import { CONTACT_FIELD_KEY_PATTERN } from "../../../contracts/ContactContracts";
import { foldAnswer } from "../../../contracts/FieldValues";
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
  // `{g_…}` son los Datos del negocio: un campo con ese nombre nunca se leería.
  if (key.toLowerCase().startsWith("g_")) throw new ValidationError("Las claves que empiezan por «g_» son de Datos del negocio: elige otro nombre.");
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
    if (!options.some((existing) => foldAnswer(existing) === foldAnswer(item))) options.push(item);
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
// Vive en `contracts/FieldValues` (lo usan también el motor y la web).
export { coerceFieldValue } from "../../../contracts/FieldValues";
