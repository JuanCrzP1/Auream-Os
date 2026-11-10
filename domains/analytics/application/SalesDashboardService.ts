import type { AdsMoneySummary, Breakdown, DashboardFilters, SalesDashboardResponse } from "../../../contracts/DashboardContracts";
import { CurrencyConverter, type FxRates } from "./CurrencyConverter";
import { change, periodOf, previousPeriod, type Period } from "./DashboardPeriod";
import type { AdsReader, BreakdownRow, DashboardScope, SalesReader, SpendDay } from "./DashboardReaders";
import { MoneyBook, mostUsedCurrency, ratio, round } from "./MoneyBook";

// ---------------------------------------------------------------------------
// Dashboard › Ventas: lo vendido, los leads, la conversión y, para quien ve
// el gasto, la plata de los anuncios (ROAS real frente al de Meta, ganancia,
// costo por venta y por chat). Todo en una moneda de reporte, con la tasa del
// día. Solo lee: Ventas, Meta Ads y Conversaciones son las fuentes.
// ---------------------------------------------------------------------------

export interface DashboardActor {
  readonly tenantId: string;
  /** Puede ver el gasto en anuncios (`ads.read`). */
  readonly canSeeAds: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scopeOf(filters: DashboardFilters): DashboardScope {
  return {
    ...(filters.connectionId && UUID.test(filters.connectionId) ? { connectionId: filters.connectionId } : {}),
    ...(filters.productId && UUID.test(filters.productId) ? { productId: filters.productId } : {})
  };
}

export class SalesDashboardService {
  public constructor(
    private readonly sales: SalesReader,
    private readonly ads: AdsReader,
    private readonly fx: FxRates,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async overview(actor: DashboardActor, filters: DashboardFilters): Promise<SalesDashboardResponse> {
    const { tenantId } = actor;
    const timezone = await this.timezoneOf(tenantId);
    const period = periodOf(filters.from, filters.to, timezone, this.now());
    const before = previousPeriod(period, timezone);
    const scope = scopeOf(filters);
    await this.fx.refresh();
    const [rates, days, prevDays, leads, prevLeads, byHour, review, recent, status] = await Promise.all([
      this.fx.table(before.fromDay, period.toDay),
      this.sales.days(tenantId, period, scope, timezone),
      this.sales.days(tenantId, before, scope, timezone),
      this.sales.leads(tenantId, period, scope),
      this.sales.leads(tenantId, before, scope),
      this.sales.byHour(tenantId, period, scope, timezone),
      this.sales.reviewCount(tenantId),
      this.sales.recent(tenantId, scope, 8),
      actor.canSeeAds ? this.ads.status(tenantId) : Promise.resolve(null)
    ]);
    const converter = new CurrencyConverter(rates);
    // La moneda de reporte: la de la cuenta de anuncios con más gasto o, si no, la más vendida que se pueda convertir.
    const convertible = (rows: typeof days) => rows.filter((row) => converter.has(row.currency));
    const book = new MoneyBook(converter, status?.mainCurrency ?? mostUsedCurrency(convertible(days)) ?? mostUsedCurrency(days) ?? mostUsedCurrency(prevDays) ?? "USD");
    const money = (day: { day: string; currency: string }, amount: number) => ({ amount, currency: day.currency, day: day.day });

    const revenue = book.sum(days, (d) => money(d, d.amount));
    const prevRevenue = book.sum(prevDays, (d) => money(d, d.amount));
    const count = days.reduce((sum, d) => sum + d.count, 0);
    const prevCount = prevDays.reduce((sum, d) => sum + d.count, 0);
    const cost = book.sum(days, (d) => money(d, d.cost));
    const costsKnown = count > 0 && days.every((d) => d.withoutCost === 0);

    const hasAds = status !== null && status.accounts > 0;
    const [spendDays, prevSpendDays] = hasAds ? await Promise.all([this.ads.spend(tenantId, period), this.ads.spend(tenantId, before)]) : [[], []];
    const spend = book.sum(spendDays, (d) => money(d, d.spend));
    const ads = hasAds ? this.adsSummary(book, days, prevDays, spendDays, prevSpendDays, status!.activeCampaigns) : null;
    const [byConnection, byProduct, byCountry] = await Promise.all(
      (["connection", "product", "country"] as const).map((by) => this.sales.breakdown(tenantId, period, scope, timezone, by).then((rows) => group(book, rows)))
    );

    return {
      currency: book.currency,
      missingRates: book.missing,
      revenue: { value: revenue, previous: prevRevenue, change: change(revenue, prevRevenue) },
      sales: { value: count, previous: prevCount, change: change(count, prevCount) },
      averageTicket: count > 0 ? round(revenue / count) : null,
      leads: { value: leads.total, previous: prevLeads.total, change: change(leads.total, prevLeads.total) },
      leadsFromAds: leads.fromAds,
      conversion: leads.total > 0 ? Math.round((count / leads.total) * 1000) / 1000 : null,
      reviewCount: review,
      ads: ads ? { ...ads, realProfit: costsKnown ? round(ads.revenue.value - spend - cost) : null } : null,
      realProfit: costsKnown ? round(revenue - cost - spend) : null,
      costsKnown,
      daily: dailySeries(period, book, days, spendDays),
      funnel: ads ? { impressions: ads.impressions, clicks: ads.clicks, chats: ads.chats, sales: ads.attributedSales } : null,
      byHour,
      byConnection,
      byProduct,
      byCountry,
      recentSales: recent,
      canSeeAds: actor.canSeeAds
    };
  }

  private adsSummary(book: MoneyBook, days: SalesReaderDays, prevDays: SalesReaderDays, spendDays: ReadonlyArray<SpendDay>, prevSpendDays: ReadonlyArray<SpendDay>, activeCampaigns: number): Omit<AdsMoneySummary, "realProfit"> {
    const pick = (amount: (d: SpendDay) => number) => (d: SpendDay) => ({ amount: amount(d), currency: d.currency, day: d.day });
    const spend = book.sum(spendDays, pick((d) => d.spend));
    const prevSpend = book.sum(prevSpendDays, pick((d) => d.spend));
    const metaRevenue = book.sum(spendDays, pick((d) => d.metaRevenue));
    const adRevenue = book.sum(days, (d) => ({ amount: d.adAmount, currency: d.currency, day: d.day }));
    const prevAdRevenue = book.sum(prevDays, (d) => ({ amount: d.adAmount, currency: d.currency, day: d.day }));
    const adSales = days.reduce((sum, d) => sum + d.adCount, 0);
    const chats = spendDays.reduce((sum, d) => sum + d.conversations, 0);
    const profit = round(adRevenue - spend);
    const prevProfit = round(prevAdRevenue - prevSpend);
    return {
      spend: { value: spend, previous: prevSpend, change: change(spend, prevSpend) },
      revenue: { value: adRevenue, previous: prevAdRevenue, change: change(adRevenue, prevAdRevenue) },
      profit: { value: profit, previous: prevProfit, change: prevProfit !== 0 ? (profit - prevProfit) / Math.abs(prevProfit) : null },
      roas: ratio(adRevenue, spend),
      roasMeta: ratio(metaRevenue, spend),
      costPerSale: adSales > 0 ? round(spend / adSales) : null,
      costPerChat: chats > 0 ? round(spend / chats) : null,
      revenuePerChat: chats > 0 ? round(adRevenue / chats) : null,
      chats,
      attributedSales: adSales,
      impressions: spendDays.reduce((sum, d) => sum + d.impressions, 0),
      clicks: spendDays.reduce((sum, d) => sum + d.clicks, 0),
      activeCampaigns
    };
  }
}

type SalesReaderDays = Awaited<ReturnType<SalesReader["days"]>>;

/** Una fila por día del periodo (aunque no haya ventas), con lo vendido y lo gastado. */
function dailySeries(period: Period, book: MoneyBook, days: SalesReaderDays, spend: ReadonlyArray<SpendDay>) {
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

function group(book: MoneyBook, rows: ReadonlyArray<BreakdownRow>): Breakdown[] {
  const map = new Map<string, { key: string; label: string; revenue: number; sales: number }>();
  for (const row of rows) {
    const entry = map.get(row.key) ?? { key: row.key, label: row.label, revenue: 0, sales: 0 };
    entry.revenue += book.convert(row.amount, row.currency, row.day);
    entry.sales += row.count;
    map.set(row.key, entry);
  }
  return [...map.values()].map((entry) => ({ ...entry, revenue: round(entry.revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
}
