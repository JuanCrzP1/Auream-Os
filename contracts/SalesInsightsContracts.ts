import type { ProductKind } from "./SalesContracts";

// ---------------------------------------------------------------------------
// Lo que muestra la portada de Ventas (`GET /sales/insights`): lo vendido por
// moneda frente al periodo anterior, la curva por día, el mejor día y lo que
// más vende; y la marcha de cada producto (`GET /sales/product-stats`).
// Solo ventas APROBADAS. Los días van en la zona horaria de la empresa.
// ---------------------------------------------------------------------------

export interface CurrencyInsight {
  readonly currency: string;
  readonly amount: number;
  readonly count: number;
  /** Ticket promedio. */
  readonly average: number;
  /** Lo vendido en el periodo anterior del mismo largo; `null` si el periodo es «Todo». */
  readonly previousAmount: number | null;
  /** Cambio en porcentaje frente al anterior (entero); `null` si no hay con qué comparar. */
  readonly change: number | null;
}

export interface DayPoint {
  /** `YYYY-MM-DD` en la zona de la empresa. */
  readonly day: string;
  readonly amount: number;
}

/** La curva de una moneda: un punto por día del periodo (los días sin ventas en 0). */
export interface CurrencySeries {
  readonly currency: string;
  readonly points: ReadonlyArray<DayPoint>;
}

export interface TopProduct {
  readonly productId: string;
  readonly name: string;
  readonly kind: ProductKind | null;
  readonly count: number;
  /** Parte de las ventas aprobadas del periodo (0–100, entero). */
  readonly share: number;
}

export interface SalesInsightsResponse {
  /** Por moneda, la que más vendió primero. */
  readonly currencies: ReadonlyArray<CurrencyInsight>;
  /** Curvas de las monedas (máximo 3), en el mismo orden. Vacío si el periodo es «Todo». */
  readonly series: ReadonlyArray<CurrencySeries>;
  /** El mejor día de la moneda principal. */
  readonly bestDay: (DayPoint & { readonly currency: string }) | null;
  readonly topProducts: ReadonlyArray<TopProduct>;
}

export interface ProductStats {
  readonly productId: string;
  /** Ventas aprobadas por semana, de la más vieja a la actual (8 semanas). */
  readonly weekly: ReadonlyArray<number>;
  /** Ventas de las últimas 4 semanas. */
  readonly recent: number;
  /** Cambio frente a las 4 semanas anteriores, en porcentaje entero; `null` si antes no hubo. */
  readonly change: number | null;
}

export interface ProductStatsResponse {
  readonly products: ReadonlyArray<ProductStats>;
}
