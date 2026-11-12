import { CURRENCY_CODES } from "../../../contracts/Countries";
import type { Money } from "../../../contracts/CrmContracts";
import { parseAmount } from "../../../flow-engine/values/parseAmount";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Una compra de un cliente en un embudo: en qué etapa está (para la compra
// actual, la etiqueta lo dice; aquí queda la última conocida y desde cuándo),
// cuánto vale, qué producto, quién lo atiende, la venta que la cerró y el
// anuncio por el que llegó. Un cliente puede tener varias (1.ª, 2.ª…); solo
// una es la actual. El valor va siempre con su moneda.
// ---------------------------------------------------------------------------

export interface Deal {
  readonly id: string;
  /** 1.ª, 2.ª, 3.ª… compra del cliente en este embudo. */
  readonly number: number;
  /** La compra actual: la que mueven las etiquetas, los flujos y las ventas. */
  readonly current: boolean;
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
  /** Cuándo se abrió esta compra (entró al embudo). */
  readonly openedAt: string;
  /** La venta aprobada que la cerró. */
  readonly saleId: string | null;
  /** El anuncio por el que llegó al abrirse. */
  readonly adSourceId: string | null;
}

/**
 * Días que deben pasar desde que una compra se cerró (ganada o perdida) para
 * que un mensaje del cliente abra otra sola. Antes de eso, un «gracias» o una
 * duda de entrega no es una compra nueva. Un flujo, un asesor o una venta sí
 * la abren cuando quieran.
 */
export const REOPEN_AFTER_DAYS = 7;

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

/** En qué quedó una compra según su etapa: aún no compra, ya compró o no compró. */
type Outcome = "open" | "won" | "lost";

/**
 * ¿Pasar a esta etapa abre OTRA compra? Sí cuando la compra actual ya cerró
 * (ganó o se perdió) y el cliente vuelve a una etapa de «aún no compra», o
 * vuelve a entrar al embudo después de haber comprado. Moverse entre etapas
 * de compra (Pagó → Entregado) sigue siendo la misma compra.
 */
export function opensNewPurchase(current: Pick<Deal, "stageId" | "wonAt"> | null, currentOutcome: Outcome | null, target: Outcome): boolean {
  if (!current) return false;
  const closed = current.wonAt !== null || currentOutcome === "lost";
  return closed && target === "open";
}

/** ¿Ya pasaron los días para que un mensaje del cliente abra otra compra sola? */
export function readyToReopen(current: Pick<Deal, "stageEnteredAt">, now: Date): boolean {
  return now.getTime() - Date.parse(current.stageEnteredAt) >= REOPEN_AFTER_DAYS * 86_400_000;
}
