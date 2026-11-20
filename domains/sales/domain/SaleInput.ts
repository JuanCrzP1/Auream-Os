import { COUNTRY_CODES_ISO } from "../../../contracts/Countries";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { parseCurrency, parseMoney } from "./Money";

// Validación de lo que escribe una persona al anotar o corregir una venta.

export function requireAmount(value: unknown): number {
  const amount = parseMoney(value);
  if (amount === null) throw new ValidationError("El monto debe ser un número mayor que cero.");
  return amount;
}

export function requireCurrency(value: unknown): string {
  const currency = parseCurrency(value);
  if (!currency) throw new ValidationError("Elige una moneda de la lista.");
  return currency;
}

export function requireCountry(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!COUNTRY_CODES_ISO.includes(code)) throw new ValidationError("Elige un país de la lista.");
  return code;
}

/** Margen para relojes un poco adelantados: una venta «de ahora» no se rechaza por segundos. */
const SOLD_AT_FUTURE_MARGIN_MS = 5 * 60_000;

/** La fecha de la venta: la escrita (nunca futura, salvo el margen) o, sin fecha, `now`. */
export function soldAtOf(value: unknown, now: Date): string {
  if (value === undefined || value === null || value === "") return now.toISOString();
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new ValidationError("La fecha de la venta no es válida.");
  if (date.getTime() > now.getTime() + SOLD_AT_FUTURE_MARGIN_MS) throw new ValidationError("La fecha de la venta no puede ser futura.");
  return date.toISOString();
}
