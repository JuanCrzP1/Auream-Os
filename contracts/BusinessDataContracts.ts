import { CONTACT_FIELD_LIMITS, keyFromLabel, type ContactFieldType } from "./ContactFieldContracts";
import type { ContactFieldValue } from "./ContactContracts";
import { coerceFieldValue, fieldValueText } from "./FieldValues";
import { valueAt, type BusinessDataSchedule } from "./BusinessDataTimeline";

// ---------------------------------------------------------------------------
// Datos del negocio (Configuración › Datos › Datos del negocio): lo que se
// repite en los mensajes de la cuenta (Pago Móvil, horario, dirección, enlace
// del grupo VIP), escrito UNA vez y usado como `{g_clave}` en flujos,
// difusiones y respuestas rápidas, y en el Condicional. El prefijo `g_` es el
// de Leona: un flujo traído de allá funciona sin tocarlo.
//
// Los flujos los leen y nunca los cambian; los editan dueños y
// administradores. Los precios NO van aquí: viven en Productos (precio por
// país), que es lo que usan Registrar venta y el ROAS. Contrato API ↔ web.
// ---------------------------------------------------------------------------

export const BUSINESS_DATA_TYPES = ["text", "number", "date", "boolean"] as const satisfies ReadonlyArray<ContactFieldType>;
export type BusinessDataType = (typeof BUSINESS_DATA_TYPES)[number];

export const BUSINESS_DATA_PREFIX = "g_";

export const BUSINESS_DATA_LIMITS = {
  maxData: 100,
  maxLabel: CONTACT_FIELD_LIMITS.maxLabel,
  /** Sin el prefijo. */
  maxKey: 40,
  maxValue: 1000,
  maxDescription: 140
} as const;

/** Mismo formato que guarda la base: `g_` y minúsculas, números o guion bajo. */
export const BUSINESS_DATA_KEY_PATTERN = /^g_[a-z0-9_]{1,40}$/;

/** ¿Es una variable de Datos del negocio? (`g_horario`). */
export const isBusinessKey = (name: string): boolean => name.startsWith(BUSINESS_DATA_PREFIX);

/** La clave que sale de un nombre: «Pago Móvil» → `g_pago_movil`. Igual en la web y en el servidor. */
export function businessKeyFromLabel(label: string): string {
  const base = keyFromLabel(label).replace(/[^a-z0-9_]/g, "_").replace(/^g_/, "").slice(0, BUSINESS_DATA_LIMITS.maxKey).replace(/_+$/, "");
  return base ? `${BUSINESS_DATA_PREFIX}${base}` : "";
}

export interface BusinessDatum {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: BusinessDataType;
  /** Guardado «a lo computador»: `1200000`, `true`, `2026-12-24`. A una persona se le muestra con `businessValueText`. */
  readonly value: string;
  /** Para qué es, opcional: «La cuenta donde pagan los de Venezuela». */
  readonly description: string;
  /** Cambios programados por venir o activos, del más próximo al más lejano (los terminados quedan en el historial). */
  readonly schedules: ReadonlyArray<BusinessDataSchedule>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Dónde se usa: un bloque de un flujo, una difusión que aún se va a enviar o una respuesta rápida. */
export type BusinessDataUse =
  | { readonly kind: "flow"; readonly flowKey: string; readonly flowName: string; readonly blockId: string; readonly blockName: string; readonly blockType: string }
  | { readonly kind: "broadcast"; readonly id: string; readonly name: string; /** Cuándo sale, si está programada (ISO): avisa si cae en un cambio programado. */ readonly sendAt: string | null }
  | { readonly kind: "quickReply"; readonly id: string; readonly shortcut: string };

/** Un mensaje real que lo usa, para «Así lo ve tu cliente». */
export interface BusinessDataExample {
  /** El texto tal cual está escrito, con sus variables. */
  readonly template: string;
  /** De dónde sale: «Flujo Ventas · Pago». */
  readonly source: string;
}

export interface BusinessDatumSummary extends BusinessDatum {
  readonly uses: ReadonlyArray<BusinessDataUse>;
  readonly example: BusinessDataExample | null;
}

export interface BusinessDataResponse {
  readonly data: ReadonlyArray<BusinessDatumSummary>;
  /** Dueños y administradores (`flows.write`): crean, cambian y borran. */
  readonly canManage: boolean;
  /** Zona horaria del negocio (IANA): la de los cambios programados. */
  readonly timeZone: string;
}

/** Solo los valores, con su tipo: para quien los pone en un texto (el chat, la vista previa de una difusión). */
export interface BusinessValuesResponse {
  readonly values: Readonly<Record<string, ContactFieldValue>>;
}

export interface SaveBusinessDatumRequest {
  readonly label: string;
  /** Solo al crear; sin ella sale del nombre. No se cambia después (rompería los mensajes). */
  readonly key?: string;
  readonly type: BusinessDataType;
  /** Como lo escribe una persona: «1.200.000», «Sí», «24/12/2026». */
  readonly value: string;
  readonly description?: string;
}

/** Borrar uno que se usa pide escribir su clave en `?confirm=`. */
export const BUSINESS_DATA_CONFIRM_PARAM = "confirm";

export const BUSINESS_DATA_TYPE_LABEL: Readonly<Record<BusinessDataType, string>> = { text: "Texto", number: "Número", date: "Fecha", boolean: "Sí o no" };

/** El valor guardado, con su tipo (lo que reciben el motor y las condiciones). `undefined` si ya no encaja. */
export function typedBusinessValue(datum: Pick<BusinessDatum, "type" | "value">): ContactFieldValue | undefined {
  return coerceFieldValue({ type: datum.type, options: [] }, datum.value);
}

/** Como lo lee una persona: «Sí», «24/12/2026», «1.200.000». */
export function businessValueText(datum: Pick<BusinessDatum, "type" | "value">): string {
  const typed = typedBusinessValue(datum);
  if (typed === undefined) return datum.value;
  return datum.type === "number" && typeof typed === "number" ? typed.toLocaleString("es-CO", { maximumFractionDigits: 2 }) : fieldValueText(typed);
}

/**
 * Los valores de la cuenta por clave, con su tipo, en ese momento: el de un
 * cambio programado mientras rige, si no el de siempre. Lo usan el motor, el
 * chat, las difusiones y la vista previa: así todos dicen lo mismo.
 */
export function businessValuesOf(
  data: ReadonlyArray<Pick<BusinessDatum, "key" | "type" | "value"> & { readonly schedules?: BusinessDatum["schedules"] }>,
  now: Date = new Date()
): Record<string, ContactFieldValue> {
  const values: Record<string, ContactFieldValue> = {};
  for (const datum of data) {
    const typed = typedBusinessValue({ type: datum.type, value: valueAt(datum, now) });
    if (typed !== undefined) values[datum.key] = typed;
  }
  return values;
}

const BUSINESS_VARIABLE = /\{(g_[A-Za-z0-9_]{1,40})(?:\|([^{}\r\n]{0,100}))?\}/g;

/**
 * Pone los Datos del negocio en un texto y deja lo demás tal cual (`{nombre}`
 * lo pone quien sabe el nombre). Uno que no existe queda con su valor por
 * defecto, o vacío: igual que en los flujos.
 */
export function fillBusinessData(text: string, values: Readonly<Record<string, ContactFieldValue>>): string {
  return text.replace(BUSINESS_VARIABLE, (_match, key: string, fallback: string | undefined) => {
    const value = values[key];
    if (value === undefined || value === "") return fallback?.trim() ?? "";
    return fieldValueText(value);
  });
}

/** Las claves `g_…` que usa un texto, sin repetir. */
export function businessKeysIn(text: string): string[] {
  const keys: string[] = [];
  for (const match of text.matchAll(BUSINESS_VARIABLE)) if (!keys.includes(match[1]!)) keys.push(match[1]!);
  return keys;
}
