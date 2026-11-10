import { CURRENCY_CODES } from "../../../contracts/Countries";
import { parseAmount } from "../../../flow-engine/values/parseAmount";

// ---------------------------------------------------------------------------
// Leer montos y monedas tal como llegan de un comprobante o de una variable:
// «$150.000», «150,000.50», «1.250,75», «COP», «cop». Lo que no se entiende
// devuelve `null` (la venta queda «Por revisar»): nunca se adivina un número.
//
// Los separadores se leen con la MISMA regla del Comprobante y del Pixel
// (`parseAmount`): una venta y su evento de Compra nunca dan montos distintos.
// ---------------------------------------------------------------------------

/** Tope: cabe en `numeric(14,2)`. */
const MAX = 999_999_999_999;

export function parseMoney(raw: unknown): number | null {
  const value = typeof raw === "number" ? (Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) / 100 : null) : typeof raw === "string" ? parseAmount(raw) : null;
  return value !== null && value <= MAX ? value : null;
}

/** «cop» → «COP»; lo que no es una moneda de la lista → `null`. */
export function parseCurrency(raw: unknown): string | null {
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return CURRENCY_CODES.includes(code) ? code : null;
}
