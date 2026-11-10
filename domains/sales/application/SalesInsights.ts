import type { CurrencyInsight, CurrencySeries, ProductStatsResponse, SalesInsightsResponse, TopProduct } from "../../../contracts/SalesInsightsContracts";
import { PRODUCT_KINDS, type ProductKind, type SaleFilters } from "../../../contracts/SalesContracts";
import { salePeriod } from "../domain/SalePeriod";
import type { SaleQuery, SaleRepository } from "./SaleRepository";
import type { SalesInsightsReader } from "./SalesInsightsReader";

// ---------------------------------------------------------------------------
// SalesInsights — lo que cuenta la portada de Ventas: lo vendido por moneda
// frente al periodo anterior del mismo largo, la curva por día y el mejor día,
// lo que más vende y la marcha de cada producto (8 semanas). Solo lee.
// Separado de `SaleServices` a propósito: analizar no es registrar.
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cambio en porcentaje entero; `null` si antes no hubo nada con qué comparar. */
export function percentChange(current: number, previous: number | null): number | null {
  if (previous === null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Los días `YYYY-MM-DD` de `from` a `to`, ambos incluidos (máximo 400). */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let at = Date.parse(`${from}T00:00:00Z`); at <= Date.parse(`${to}T00:00:00Z`) && days.length < 400; at += DAY) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
}

export class SalesInsights {
  public constructor(
    private readonly sales: Pick<SaleRepository, "totals">,
    private readonly reader: SalesInsightsReader,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async overview(tenantId: string, filters: Pick<SaleFilters, "from" | "to" | "productId">): Promise<SalesInsightsResponse> {
    const timezone = await this.timezoneOf(tenantId);
    const period = filters.from || filters.to ? salePeriod(filters.from, filters.to, timezone) : { from: null, until: null };
    const query: SaleQuery = { ...(filters.productId && UUID.test(filters.productId) ? { productId: filters.productId } : {}), from: period.from, until: period.until };

    const totals = await this.sales.totals(tenantId, query);
    const comparable = period.from && period.until;
    const previous = comparable
      ? new Map((await this.sales.totals(tenantId, { ...query, from: new Date(2 * period.from!.getTime() - period.until!.getTime()), until: period.from })).map((t) => [t.currency, t.amount]))
      : null;
    const currencies: CurrencyInsight[] = totals.map((total) => {
      const before = previous ? (previous.get(total.currency) ?? 0) : null;
      return {
        currency: total.currency,
        amount: total.amount,
        count: total.count,
        average: Math.round((total.amount / total.count) * 100) / 100,
        previousAmount: before,
        change: percentChange(total.amount, before)
      };
    });

    const series = comparable && filters.from && filters.to ? await this.series(tenantId, query, currencies.slice(0, 3).map((c) => c.currency), filters.from, filters.to, timezone) : [];
    const main = series[0];
    const best = main?.points.reduce((top, point) => (point.amount > top.amount ? point : top), { day: "", amount: 0 });

    const sold = currencies.reduce((sum, currency) => sum + currency.count, 0);
    const topProducts: TopProduct[] = (await this.reader.topProducts(tenantId, query, 3)).map((product) => ({
      productId: product.productId,
      name: product.name,
      kind: PRODUCT_KINDS.includes(product.kind as ProductKind) ? (product.kind as ProductKind) : null,
      count: product.count,
      share: sold > 0 ? Math.round((product.count / sold) * 100) : 0
    }));

    return { currencies, series, bestDay: main && best && best.amount > 0 ? { ...best, currency: main.currency } : null, topProducts };
  }

  /** Ventas aprobadas de cada producto en las últimas 8 semanas, y las 4 últimas frente a las 4 anteriores. */
  public async productStats(tenantId: string): Promise<ProductStatsResponse> {
    const now = this.now();
    const rows = await this.reader.weekly(tenantId, new Date(now.getTime() - 8 * WEEK), now);
    const byProduct = new Map<string, number[]>();
    for (const row of rows) {
      if (row.weeksAgo < 0 || row.weeksAgo > 7) continue;
      const weeks = byProduct.get(row.productId) ?? new Array<number>(8).fill(0);
      weeks[7 - row.weeksAgo] = (weeks[7 - row.weeksAgo] ?? 0) + row.count;
      byProduct.set(row.productId, weeks);
    }
    return {
      products: [...byProduct.entries()].map(([productId, weekly]) => {
        const recent = weekly.slice(4).reduce((a, b) => a + b, 0);
        const before = weekly.slice(0, 4).reduce((a, b) => a + b, 0);
        return { productId, weekly, recent, change: percentChange(recent, before) };
      })
    };
  }

  private async series(tenantId: string, query: SaleQuery, currencies: ReadonlyArray<string>, from: string, to: string, timezone: string): Promise<CurrencySeries[]> {
    if (currencies.length === 0) return [];
    const rows = await this.reader.daily(tenantId, query, currencies, timezone);
    const days = daysBetween(from, to);
    return currencies.map((currency) => {
      const amounts = new Map(rows.filter((row) => row.currency === currency).map((row) => [row.day, row.amount]));
      return { currency, points: days.map((day) => ({ day, amount: amounts.get(day) ?? 0 })) };
    });
  }
}
