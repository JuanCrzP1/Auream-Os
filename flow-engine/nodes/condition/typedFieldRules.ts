import { parseFieldDate, parseFieldNumber } from "../../../contracts/FieldValues";

// ---------------------------------------------------------------------------
// Reglas con tipo sobre un campo del cliente (ver `TYPED_FIELD_OPERATORS` en
// `contracts/ConditionConfig`): una de las opciones, entre dos números y las
// de fecha. «Hoy» es la fecha del negocio (su zona horaria), no la del
// servidor. Puro.
//
// `undefined`: el operador no es uno de estos (lo evalúa la comparación de
// siempre). Un dato que no se puede leer con su tipo no cumple la regla.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días entre dos fechas AAAA-MM-DD (b − a). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** ¿Hoy es su día y mes? Un 29 de febrero se celebra el 28 en los años que no son bisiestos. */
function isAnniversary(date: string, today: string): boolean {
  const monthDay = date.slice(5);
  if (monthDay === today.slice(5)) return true;
  return monthDay === "02-29" && today.slice(5) === "02-28" && !isLeapYear(Number(today.slice(0, 4)));
}

/**
 * @param equal   cómo se comparan dos valores (con tipo y sin tildes), para «una de»
 * @param today   la fecha de hoy en la zona del negocio (AAAA-MM-DD)
 */
export function compareTypedField(
  actual: unknown,
  operator: string,
  values: ReadonlyArray<string>,
  equal: (actual: unknown, expected: string) => boolean,
  today: string
): boolean | undefined {
  switch (operator) {
    case "is_one_of":
      return values.some((value) => equal(actual, value));
    case "is_none_of":
      return !values.some((value) => equal(actual, value));
    case "between": {
      const number = parseFieldNumber(typeof actual === "number" ? actual : typeof actual === "string" ? actual : undefined);
      const [low, high] = values.map((value) => parseFieldNumber(value));
      if (number === undefined || low === undefined || high === undefined) return false;
      return number >= Math.min(low, high) && number <= Math.max(low, high);
    }
    case "anniversary_today": {
      const date = parseFieldDate(actual);
      return date !== undefined && isAnniversary(date, today);
    }
    case "within_next_days": {
      const date = parseFieldDate(actual);
      const days = Number(values[0]);
      if (date === undefined || !Number.isInteger(days)) return false;
      const ahead = daysBetween(today, date);
      return ahead >= 0 && ahead <= days;
    }
    case "at_least_days_ago": {
      const date = parseFieldDate(actual);
      const days = Number(values[0]);
      return date !== undefined && Number.isInteger(days) && daysBetween(date, today) >= days;
    }
    case "before_date":
    case "after_date": {
      const date = parseFieldDate(actual);
      const limit = parseFieldDate(values[0]);
      if (date === undefined || limit === undefined) return false;
      return operator === "before_date" ? date < limit : date > limit;
    }
    default:
      return undefined;
  }
}
