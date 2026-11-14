import { salesUnknown } from "../../../contracts/AdMeasurementContracts";
import type { AdsMoneySummary, Breakdown } from "../../../contracts/DashboardContracts";
import { measurementOf } from "../domain/adMeasurement";
import { change, type Period } from "./DashboardPeriod";
import type { BreakdownRow, LeadCounts, SalesDay, SpendDay } from "./DashboardReaders";
import { ratio, round, type MoneyBook } from "./MoneyBook";

// ---------------------------------------------------------------------------
// Las piezas puras de Dashboard › Ventas: la conversión, la ganancia, la
// serie por día, los desgloses y el resumen de Meta. Sin base ni reloj.
// ---------------------------------------------------------------------------

/** De los leads nuevos, la parte que compró (0 a 1, con tres decimales). */
export function conversionOf(leads: LeadCounts): number | null {
  return leads.total > 0 ? Math.round((Math.min(leads.converted, leads.total) / leads.total) * 1000) / 1000 : null;
}

/** Puede ser negativo (una ganancia): el cambio se mide contra su valor absoluto. */
export function signedTrend(value: number, previous: number) {
  return { value, previous, change: previous !== 0 ? (value - previous) / Math.abs(previous) : null };
}

/** Una fila por día del periodo (aunque no haya ventas), con lo vendido y lo gastado en Meta. */
export function dailySeries(period: Period, book: MoneyBook, days: ReadonlyArray<SalesDay>, spend: ReadonlyArray<SpendDay>) {
  const series: Array<{ day: string; revenue: number; spend: number }> = [];
  for (let i = 0; i < period.days; i += 1) {
    const day = new Date(Date.UTC(+period.fromDay.slice(0, 4), +period.fromDay.slice(5, 7) - 1, +period.fromDay.slice(8, 10) + i)).toISOString().slice(0, 10);
    series.push({
      day,
      revenue: book.sum(days.filter((d) => d.day === day), (d) => ({ amount: d.amount, currency: d.currency, day })),
      spend: book.sum(spend.filter((d) => d.day === day), (d) => ({ amount: d.spend, currency: d.currency, day }))
    });
  }
  return series;
}

export function group(book: MoneyBook, rows: ReadonlyArray<BreakdownRow>): Breakdown[] {
  const map = new Map<string, { key: string; label: string; revenue: number; sales: number }>();
  for (const row of rows) {
    const entry = map.get(row.key) ?? { key: row.key, label: row.label, revenue: 0, sales: 0 };
    entry.revenue += book.convert(row.amount, row.currency, row.day);
    entry.sales += row.count;
    map.set(row.key, entry);
  }
  return [...map.values()].map((entry) => ({ ...entry, revenue: round(entry.revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
}

/**
 * Lo de Meta en el periodo: gasto, lo que trajeron sus anuncios, ROAS y costos
 * por chat y por venta. `watch`: lo que llegó a Auream por anuncio y si el
 * negocio anota ventas; sin ventas que mirar no hay ROAS real (no es 0).
 */
export function adsSummary(
  book: MoneyBook,
  days: ReadonlyArray<SalesDay>,
  prevDays: ReadonlyArray<SalesDay>,
  spendDays: ReadonlyArray<SpendDay>,
  prevSpendDays: ReadonlyArray<SpendDay>,
  activeCampaigns: number,
  watch: { readonly arrivedChats: number; readonly recordsSales: boolean }
): Omit<AdsMoneySummary, "realProfit"> {
  const pick = (amount: (d: SpendDay) => number) => (d: SpendDay) => ({ amount: amount(d), currency: d.currency, day: d.day });
  const spend = book.sum(spendDays, pick((d) => d.spend));
  const prevSpend = book.sum(prevSpendDays, pick((d) => d.spend));
  const metaRevenue = book.sum(spendDays, pick((d) => d.metaRevenue));
  const adRevenue = book.sum(days, (d) => ({ amount: d.adAmount, currency: d.currency, day: d.day }));
  const prevAdRevenue = book.sum(prevDays, (d) => ({ amount: d.adAmount, currency: d.currency, day: d.day }));
  const adSales = days.reduce((sum, d) => sum + d.adCount, 0);
  const chats = spendDays.reduce((sum, d) => sum + d.conversations, 0);
  const metaPurchases = spendDays.reduce((sum, d) => sum + d.metaPurchases, 0);
  const measurement = measurementOf({ metaChats: chats, arrivedChats: watch.arrivedChats, sales: adSales, metaPurchases, recordsSales: watch.recordsSales });
  const blind = salesUnknown(measurement, adSales);
  return {
    spend: { value: spend, previous: prevSpend, change: change(spend, prevSpend) },
    revenue: { value: adRevenue, previous: prevAdRevenue, change: change(adRevenue, prevAdRevenue) },
    profit: signedTrend(round(adRevenue - spend), round(prevAdRevenue - prevSpend)),
    roas: blind ? null : ratio(adRevenue, spend),
    roasMeta: ratio(metaRevenue, spend),
    costPerSale: adSales > 0 ? round(spend / adSales) : null,
    costPerSaleMeta: metaPurchases > 0 ? round(spend / metaPurchases) : null,
    metaRevenue: round(metaRevenue),
    metaPurchases,
    costPerChat: chats > 0 ? round(spend / chats) : null,
    revenuePerChat: chats > 0 && !blind ? round(adRevenue / chats) : null,
    chats,
    attributedSales: adSales,
    impressions: spendDays.reduce((sum, d) => sum + d.impressions, 0),
    clicks: spendDays.reduce((sum, d) => sum + d.clicks, 0),
    activeCampaigns,
    measurement
  };
}
