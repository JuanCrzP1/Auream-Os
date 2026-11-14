import { readEnum, readString } from "./ConfigReaders";
import { RESERVED_FIELD_KEYS } from "./ContactFieldContracts";
import { coerceFieldValue } from "./FieldValues";

// ---------------------------------------------------------------------------
// Guardar dato (el «Manipulador» de Leona) — contrato compartido por el
// editor y el motor (`SetFieldNodeHandler`). Un dato por bloque:
//
//   set        pone un valor (fijo o con variables: «usada», «{cancion_2}»)
//   add · subtract · multiply · divide
//              cuentas con el número que ya tiene (vacío cuenta como 0):
//              reintentos, puntos, un monto en otra moneda
//
// El dato queda en la conversación (`{campo}` en los bloques siguientes) y,
// si es un Campo del cliente, en su ficha, convertido a su tipo. Los Datos
// del negocio (`g_…`) y los datos que llena Auream no se cambian desde un flujo.
// ---------------------------------------------------------------------------

export const SET_FIELD_OPERATIONS = ["set", "add", "subtract", "multiply", "divide"] as const;
export type SetFieldOperation = (typeof SET_FIELD_OPERATIONS)[number];

export interface SetFieldConfig {
  /** La clave del dato: `cancion_video`, `reintentos`. */
  readonly field: string;
  readonly operation: SetFieldOperation;
  /** El valor (con variables) o, en una cuenta, el número con el que se opera. */
  readonly value: string;
}

export const SET_FIELD_DEFAULT_CONFIG: SetFieldConfig = { field: "", operation: "set", value: "" };

export const SET_FIELD_LIMITS = { maxValue: 1000 } as const;

/** Letras, números, `_`, `-` y `.` (como `{ia.respuesta}`); empieza por letra o `_`. */
export const SET_FIELD_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/;

export const SET_FIELD_OPERATION_LABEL: Readonly<Record<SetFieldOperation, string>> = {
  set: "Poner un valor",
  add: "Sumar",
  subtract: "Restar",
  multiply: "Multiplicar",
  divide: "Dividir"
};

/** El signo de cada cuenta, para el resumen («{reintentos} + 1»). */
export const SET_FIELD_OPERATION_SIGN: Readonly<Record<Exclude<SetFieldOperation, "set">, string>> = { add: "+", subtract: "−", multiply: "×", divide: "÷" };

export function readSetFieldConfig(config: Readonly<Record<string, unknown>>): SetFieldConfig {
  return {
    field: readString(config.field).trim().replace(/^\{|\}$/g, ""),
    operation: readEnum(config.operation, SET_FIELD_OPERATIONS, "set"),
    value: readString(config.value).slice(0, SET_FIELD_LIMITS.maxValue)
  };
}

/** ¿Es un dato que un flujo no puede cambiar? (los Datos del negocio y los que llena Auream). */
export function isProtectedField(key: string): boolean {
  return key.startsWith("g_") || key.startsWith("__") || RESERVED_FIELD_KEYS.has(key);
}

const asNumber = (raw: unknown): number | undefined => {
  const typed = coerceFieldValue({ type: "number", options: [] }, raw);
  return typeof typed === "number" && Number.isFinite(typed) ? typed : undefined;
};

/** Sin decimales de más por la aritmética de la computadora (0.1 + 0.2). */
const tidy = (value: number): number => Math.round(value * 1e6) / 1e6;

export type SetFieldOutcome =
  | { readonly ok: true; readonly value: string | number }
  | { readonly ok: false; readonly reason: "not_a_number" | "divide_by_zero" };

/**
 * El valor nuevo. `current` es el que el dato tiene ahora; `operand`, el
 * valor del bloque ya con sus variables puestas. Una cuenta con algo que no es
 * número no cambia nada (lo dice `reason`): nunca se guarda basura.
 */
export function applySetField(operation: SetFieldOperation, current: unknown, operand: string): SetFieldOutcome {
  if (operation === "set") return { ok: true, value: operand };
  const right = asNumber(operand);
  if (right === undefined) return { ok: false, reason: "not_a_number" };
  const empty = current === undefined || current === null || (typeof current === "string" && current.trim() === "");
  const left = empty ? 0 : asNumber(current);
  if (left === undefined) return { ok: false, reason: "not_a_number" };
  switch (operation) {
    case "add":
      return { ok: true, value: tidy(left + right) };
    case "subtract":
      return { ok: true, value: tidy(left - right) };
    case "multiply":
      return { ok: true, value: tidy(left * right) };
    case "divide":
      return right === 0 ? { ok: false, reason: "divide_by_zero" } : { ok: true, value: tidy(left / right) };
  }
}
