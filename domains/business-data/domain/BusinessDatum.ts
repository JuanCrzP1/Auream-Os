import {
  BUSINESS_DATA_KEY_PATTERN,
  BUSINESS_DATA_LIMITS as LIMITS,
  BUSINESS_DATA_TYPES,
  businessKeyFromLabel,
  type BusinessDataType
} from "../../../contracts/BusinessDataContracts";
import { RESERVED_FIELD_KEYS } from "../../../contracts/ContactFieldContracts";
import { coerceFieldValue } from "../../../contracts/FieldValues";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Un dato del negocio: sus reglas (nombre, clave `g_…`, tipo, valor y para
// qué es) y cómo se guarda el valor: «a lo computador», según su tipo, para
// que «1.200.000», «Sí» o «24/12/2026» valgan lo mismo en un mensaje y en una
// condición. Puro: sin base ni red.
// ---------------------------------------------------------------------------

export interface DatumShape {
  readonly key: string;
  readonly label: string;
  readonly type: BusinessDataType;
  readonly value: string;
  readonly description: string;
}

type DatumInput = { readonly label?: unknown; readonly key?: unknown; readonly type?: unknown; readonly value?: unknown; readonly description?: unknown };

const HINT: Readonly<Record<BusinessDataType, string>> = {
  text: "Escribe el valor.",
  number: "Escríbelo solo con números, por ejemplo 1.200.000.",
  date: "Escribe la fecha así: 24/12/2026.",
  boolean: "Elige Sí o No."
};

function requireLabel(value: unknown): string {
  const label = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!label) throw new ValidationError("Ponle un nombre (p. ej. «Pago Móvil» u «Horario»).");
  if (label.length > LIMITS.maxLabel) throw new ValidationError(`El nombre admite hasta ${LIMITS.maxLabel} caracteres.`);
  return label;
}

/** La que llega (un flujo de Leona que ya usa `{g_x}`) o la que sale del nombre. */
function requireKey(value: unknown, label: string): string {
  const raw = typeof value === "string" && value.trim() ? value.trim().toLowerCase() : businessKeyFromLabel(label);
  const key = raw.startsWith("g_") ? raw : `g_${raw}`;
  if (!BUSINESS_DATA_KEY_PATTERN.test(key)) throw new ValidationError("La clave empieza por «g_» y solo admite letras sin tildes, números y «_».");
  if (RESERVED_FIELD_KEYS.has(key)) throw new ValidationError(`«{${key}}» ya lo llena Auream: elige otro nombre.`);
  return key;
}

function requireType(value: unknown): BusinessDataType {
  if (typeof value === "string" && (BUSINESS_DATA_TYPES as ReadonlyArray<string>).includes(value)) return value as BusinessDataType;
  throw new ValidationError("Elige el tipo: texto, número, fecha o sí o no.");
}

/** El valor como se guarda: texto tal cual (sin espacios de más al borde), número sin puntos, `true`/`false`, `AAAA-MM-DD`. */
export function requireValue(type: BusinessDataType, value: unknown): string {
  const text = typeof value === "string" ? value.trim() : typeof value === "number" || typeof value === "boolean" ? String(value) : "";
  if (!text) throw new ValidationError("Escribe el valor: es lo que van a leer tus clientes.");
  if (type === "text") {
    if (text.length > LIMITS.maxValue) throw new ValidationError(`El valor admite hasta ${LIMITS.maxValue} caracteres.`);
    return text;
  }
  // Un número con letras («8 a 6») no es un número: la lectura tolerante de las respuestas lo volvería 86.
  if (type === "number" && /\p{L}/u.test(text)) throw new ValidationError(HINT[type]);
  const typed = coerceFieldValue({ type, options: [] }, text);
  if (typed === undefined) throw new ValidationError(HINT[type]);
  return String(typed);
}

function requireDescription(value: unknown): string {
  const description = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (description.length > LIMITS.maxDescription) throw new ValidationError(`La descripción admite hasta ${LIMITS.maxDescription} caracteres.`);
  return description;
}

/** Un dato nuevo, validado. */
export function requireNewDatum(input: DatumInput): DatumShape {
  const label = requireLabel(input.label);
  const type = requireType(input.type);
  return { key: requireKey(input.key, label), label, type, value: requireValue(type, input.value), description: requireDescription(input.description) };
}

/** Cambios a un dato que existe: la clave no cambia (los mensajes la usan). Si cambia el tipo, el valor debe encajar en el nuevo. */
export function requireDatumChanges(current: DatumShape, input: DatumInput): DatumShape {
  const label = input.label === undefined ? current.label : requireLabel(input.label);
  const type = input.type === undefined ? current.type : requireType(input.type);
  const value = input.value === undefined && type === current.type ? current.value : requireValue(type, input.value ?? current.value);
  const description = input.description === undefined ? current.description : requireDescription(input.description);
  return { key: current.key, label, type, value, description };
}
