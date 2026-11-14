import type { LineComparisonRow } from "../../../contracts/LineComparisonContracts";
import { change } from "./DashboardPeriod";
import type { SalesDay, SpendDay } from "./DashboardReaders";
import { type MoneyBook, ratio, round } from "./MoneyBook";
import { signedTrend } from "./SalesDashboardParts";

// ---------------------------------------------------------------------------
// Una fila de «Comparar líneas» con las mismas cuentas que el Dashboard:
// ganancia = facturación − gasto en Meta − otros gastos − costo de los
// productos (solo si todas las ventas lo tienen). Puro.
// ---------------------------------------------------------------------------

/** Lo leído de una línea (o del negocio) en el periodo y en el anterior. `spend*` `null` = gasto desconocido. */
export interface LineNumbers {
  readonly days: ReadonlyArray<SalesDay>;
  readonly prevDays: ReadonlyArray<SalesDay>;
  readonly spendDays: ReadonlyArray<SpendDay> | null;
  readonly prevSpendDays: ReadonlyArray<SpendDay> | null;
}

export interface RowIdentity {
  readonly id: string | null;
  readonly name: string;
  readonly color: string | null;
  readonly hasCampaigns: boolean;
}

export function lineRow(
  identity: RowIdentity,
  numbers: LineNumbers,
  other: { readonly now: number; readonly before: number },
  options: { readonly book: MoneyBook; readonly canSeeAds: boolean; readonly totalRevenue: number }
): LineComparisonRow {
  const { book, canSeeAds, totalRevenue } = options;
  const money = (pick: (d: SalesDay) => number) => (d: SalesDay) => ({ amount: pick(d), currency: d.currency, day: d.day });
  const spendOf = (days: ReadonlyArray<SpendDay> | null) => (days ? book.sum(days, (d) => ({ amount: d.spend, currency: d.currency, day: d.day })) : null);

  const revenue = book.sum(numbers.days, money((d) => d.amount));
  const prevRevenue = book.sum(numbers.prevDays, money((d) => d.amount));
  const sales = numbers.days.reduce((sum, d) => sum + d.count, 0);
  const costsKnown = sales > 0 && numbers.days.every((d) => d.withoutCost === 0);
  // Igual que el Dashboard: el costo se resta (en los dos periodos) solo si todas las ventas de este lo tienen.
  const cost = costsKnown ? book.sum(numbers.days, money((d) => d.cost)) : 0;
  const prevCost = costsKnown ? book.sum(numbers.prevDays, money((d) => d.cost)) : 0;
  const spend = spendOf(numbers.spendDays);
  const prevSpend = spendOf(numbers.prevSpendDays);
  const adRevenue = book.sum(numbers.days, money((d) => d.adAmount));
  const metaRevenue = numbers.spendDays ? book.sum(numbers.spendDays, (d) => ({ amount: d.metaRevenue, currency: d.currency, day: d.day })) : 0;
  const profit = round(revenue - (spend ?? 0) - other.now - cost);
  // La misma regla que el Dashboard: gasto en anuncios sin ninguna venta de ellos en Auream no es «perdió», es «no se sabe».
  const blind = canSeeAds && spend !== null && spend > 0 && numbers.days.every((d) => d.adCount === 0);

  return {
    ...identity,
    revenue: { value: revenue, previous: prevRevenue, change: change(revenue, prevRevenue) },
    sales,
    averageTicket: sales > 0 ? round(revenue / sales) : null,
    share: totalRevenue > 0 ? Math.min(1, round(revenue / totalRevenue)) : null,
    spend: canSeeAds ? spend : null,
    roas: canSeeAds && spend !== null && !blind ? ratio(adRevenue, spend) : null,
    roasMeta: canSeeAds && spend !== null ? ratio(metaRevenue, spend) : null,
    metaPurchases: canSeeAds && numbers.spendDays ? numbers.spendDays.reduce((sum, d) => sum + d.metaPurchases, 0) : null,
    metaRevenue: canSeeAds && numbers.spendDays ? round(metaRevenue) : null,
    otherSpend: canSeeAds ? other.now : null,
    profit: canSeeAds && !blind ? signedTrend(profit, round(prevRevenue - (prevSpend ?? 0) - other.before - prevCost)) : null,
    margin: canSeeAds && !blind && revenue > 0 ? round(profit / revenue) : null,
    ...(blind ? { salesUnknown: true as const } : {})
  };
}

/** De la que más gana a la que menos (las «sin medir» al final); sin ver el gasto, de la que más factura. */
export function rankRows(rows: ReadonlyArray<LineComparisonRow>, canSeeAds: boolean): LineComparisonRow[] {
  const key = (row: LineComparisonRow) => (canSeeAds ? row.profit?.value ?? -Infinity : row.revenue.value);
  return [...rows].sort((a, b) => key(b) - key(a) || b.revenue.value - a.revenue.value || a.name.localeCompare(b.name, "es"));
}

/** Las líneas suman más que el negocio: se pisan (un producto o campaña en dos líneas). */
export function sumsOverflow(rows: ReadonlyArray<LineComparisonRow>, total: LineComparisonRow): boolean {
  const over = (pick: (row: LineComparisonRow) => number) => rows.reduce((sum, row) => sum + pick(row), 0) > pick(total) + 0.5;
  return over((row) => row.revenue.value) || over((row) => row.sales) || over((row) => row.spend ?? 0);
}
