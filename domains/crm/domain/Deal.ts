import { CURRENCY_CODES } from "../../../contracts/Countries";
import type { Money } from "../../../contracts/CrmContracts";
import { parseAmount } from "../../../flow-engine/values/parseAmount";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// El cliente dentro de un embudo: en qué etapa está (la etiqueta lo dice; aquí
// queda la última conocida y desde cuándo), cuánto vale, qué producto y quién
// lo atiende. El valor va siempre con su moneda: pesos y dólares no se suman.
// ---------------------------------------------------------------------------

export interface Deal {
  readonly tenantId: string;
  readonly pipelineId: string;
  readonly contactId: string;
  readonly stageId: string | null;
  readonly stageEnteredAt: string;
  readonly wonAt: string | null;
  readonly value: Money | null;
  readonly productId: string | null;
  readonly productName: string | null;
  readonly ownerId: string | null;
}

/** Tope de monto: cabe en `numeric(14,2)`. */
const AMOUNT_MAX = 999_999_999_999;

/** Un monto positivo con hasta 2 decimales («49.900» = 49900, «12,5» = 12.5), o `ValidationError`. */
export function requireDealAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : typeof value === "string" ? parseAmount(value) : null;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) throw new ValidationError("El valor debe ser un número mayor que cero.");
  if (amount > AMOUNT_MAX) throw new ValidationError("El valor es demasiado grande.");
  return Math.round(amount * 100) / 100;
}

export function requireDealCurrency(value: unknown): string {
  const currency = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!CURRENCY_CODES.includes(currency)) throw new ValidationError("Elige una moneda de la lista.");
  return currency;
}

/** El valor que piden los datos (`null` lo quita); sin moneda no hay valor. */
export function dealValueOf(amount: unknown, currency: unknown): Money | null {
  if (amount === null || amount === "") return null;
  return { amount: requireDealAmount(amount), currency: requireDealCurrency(currency) };
}

/** Texto del valor para el historial: «$ 49.900 COP». */
export function describeMoney(value: Money | null): string {
  if (!value) return "sin valor";
  const amount = value.amount.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  return `$ ${amount} ${value.currency}`;
}
