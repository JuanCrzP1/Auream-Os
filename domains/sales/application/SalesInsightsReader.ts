import type { SaleQuery } from "./SaleRepository";

// ---------------------------------------------------------------------------
// SalesInsightsReader — puerto de lectura para la portada de Ventas: sumas y
// agrupaciones de las ventas APROBADAS. SQL: `SqlSalesInsights`; pruebas:
// `InMemorySalesInsights`. Solo lee; nunca cambia una venta.
// ---------------------------------------------------------------------------

export interface DayAmount {
  readonly currency: string;
  readonly day: string;
  readonly amount: number;
}

export interface ProductCount {
  readonly productId: string;
  readonly name: string;
  readonly kind: string | null;
  readonly count: number;
}

export interface WeeklyCount {
  readonly productId: string;
  /** 0 = esta semana (los últimos 7 días), 1 = la anterior… */
  readonly weeksAgo: number;
  readonly count: number;
}

export interface SalesInsightsReader {
  /** Lo vendido por día (en la zona dada) de esas monedas, con los filtros de la consulta. */
  daily(tenantId: string, query: SaleQuery, currencies: ReadonlyArray<string>, timezone: string): Promise<ReadonlyArray<DayAmount>>;
  /** Los productos más vendidos (por cantidad de ventas), con el nombre vigente del catálogo. */
  topProducts(tenantId: string, query: SaleQuery, limit: number): Promise<ReadonlyArray<ProductCount>>;
  /** Ventas por producto y semana desde `since` hasta `now`. */
  weekly(tenantId: string, since: Date, now: Date): Promise<ReadonlyArray<WeeklyCount>>;
}
