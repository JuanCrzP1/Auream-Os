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

export function soldAtOf(value: unknown): string {
  if (value === undefined || value === null || value === "") return new Date().toISOString();
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new ValidationError("La fecha de la venta no es válida.");
  if (date.getTime() > Date.now() + 5 * 60_000) throw new ValidationError("La fecha de la venta no puede ser futura.");
  return date.toISOString();
}
