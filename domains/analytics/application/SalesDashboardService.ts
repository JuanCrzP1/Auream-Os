import type { DashboardFilters, SalesDashboardResponse } from "../../../contracts/DashboardContracts";
import { CurrencyConverter, type FxRates } from "./CurrencyConverter";
import { change, periodOf, previousPeriod, todayIn, type Period } from "./DashboardPeriod";
import type { AdsReader, SalesReader } from "./DashboardReaders";
import { DashboardScopeResolver } from "./DashboardScopeResolver";
import { MoneyBook, mostUsedCurrency, round } from "./MoneyBook";
import { chargesOf, percentLines, revenueBase, rulesFor, totalOf, type ExpenseRule, type OtherExpensesReader, type RevenueDay } from "./OtherExpenseLedger";
import { adsSummary, conversionOf, dailySeries, group, signedTrend } from "./SalesDashboardParts";

// ---------------------------------------------------------------------------
// Dashboard › Ventas: lo vendido, los leads, la conversión y, para quien ve
// el gasto, la plata de los anuncios (ROAS real frente al de Meta), los
// otros gastos y la ganancia. Todo en una moneda de reporte, con la tasa del
// día. Solo lee: Ventas, Meta Ads, Conversaciones y Otros gastos son las
// fuentes.
// ---------------------------------------------------------------------------

export interface DashboardActor {
  readonly tenantId: string;
  /** Puede ver el gasto en anuncios (`ads.read`). */
  readonly canSeeAds: boolean;
}

export { scopeOf } from "./DashboardScopeResolver";

/** La moneda que pidió la persona, si es un código ISO que se puede convertir; si no, `null`. */
export function requestedCurrency(currency: string | undefined, converter: CurrencyConverter): string | null {
  const code = currency?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(code) && converter.has(code) ? code : null;
}

export class SalesDashboardService {
  public constructor(
    private readonly sales: SalesReader,
    private readonly ads: AdsReader,
    private readonly fx: FxRates,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly now: () => Date = () => new Date(),
    /** Resuelve la línea de venta y los filtros (sin líneas, solo lo pedido a mano). */
    private readonly scopes: DashboardScopeResolver = new DashboardScopeResolver(),
    /** Los gastos fuera de Meta (sin módulo de gastos, no hay). */
    private readonly expenses: OtherExpensesReader | null = null
  ) {}

  public async overview(actor: DashboardActor, filters: DashboardFilters): Promise<SalesDashboardResponse> {
    const { tenantId } = actor;
    const timezone = await this.timezoneOf(tenantId);
    const period = periodOf(filters.from, filters.to, timezone, this.now());
    const before = previousPeriod(period, timezone);
    const scope = await this.scopes.resolve(tenantId, filters);
    await this.fx.refresh();
    const [rates, days, prevDays, leads, prevLeads, byHour, review, recent, status, rules] = await Promise.all([
      this.fx.table(before.fromDay, period.toDay),
      this.sales.days(tenantId, period, scope, timezone),
      this.sales.days(tenantId, before, scope, timezone),
      this.sales.leads(tenantId, period, scope),
      this.sales.leads(tenantId, before, scope),
      this.sales.byHour(tenantId, period, scope, timezone),
      this.sales.reviewCount(tenantId),
      this.sales.recent(tenantId, scope, 8),
      actor.canSeeAds ? this.ads.status(tenantId, scope) : Promise.resolve(null),
      actor.canSeeAds && this.expenses ? this.expenses.list(tenantId).then((all) => rulesFor(all, filters.lineId)) : Promise.resolve([])
    ]);
    const converter = new CurrencyConverter(rates);
    // La moneda de reporte: la que pidió la persona o, si no, la de la cuenta de anuncios con más gasto o la más vendida que se pueda convertir.
    const convertible = (rows: typeof days) => rows.filter((row) => converter.has(row.currency));
    const book = new MoneyBook(
      converter,
      requestedCurrency(filters.currency, converter) ?? status?.mainCurrency ?? mostUsedCurrency(convertible(days)) ?? mostUsedCurrency(days) ?? mostUsedCurrency(prevDays) ?? "USD"
    );
    const money = (day: { day: string; currency: string }, amount: number) => ({ amount, currency: day.currency, day: day.day });

    const revenue = book.sum(days, (d) => money(d, d.amount));
    const prevRevenue = book.sum(prevDays, (d) => money(d, d.amount));
    const count = days.reduce((sum, d) => sum + d.count, 0);
    const prevCount = prevDays.reduce((sum, d) => sum + d.count, 0);
    const cost = book.sum(days, (d) => money(d, d.cost));
    const prevCost = book.sum(prevDays, (d) => money(d, d.cost));
    const costsKnown = count > 0 && days.every((d) => d.withoutCost === 0);

    const hasAds = status !== null && status.accounts > 0;
    const [spendDays, prevSpendDays] = hasAds ? await Promise.all([this.ads.spend(tenantId, period, scope), this.ads.spend(tenantId, before, scope)]) : [[], []];
    const spend = book.sum(spendDays, (d) => money(d, d.spend));
    const prevSpend = book.sum(prevSpendDays, (d) => money(d, d.spend));
    const ads = hasAds ? adsSummary(book, days, prevDays, spendDays, prevSpendDays, status!.activeCampaigns) : null;

    // Otros gastos: los fijos con la tasa del día de cada cobro; los % sobre lo vendido en lo que se mira
    // (mirando todo el negocio, el % de una línea sale de lo vendido por esa línea).
    const today = todayIn(this.now(), timezone);
    const lineSales = filters.lineId ? null : await this.lineSales(tenantId, rules, period, before, timezone);
    const charges = chargesOf(rules, period.fromDay, period.toDay, today, book, lineSales ? revenueBase(days, lineSales.now) : days);
    const other = totalOf(charges);
    const prevOther = totalOf(chargesOf(rules, before.fromDay, before.toDay, today, book, lineSales ? revenueBase(prevDays, lineSales.before) : prevDays));

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
      conversion: conversionOf(leads),
      conversionPrevious: conversionOf(prevLeads),
      convertedLeads: leads.converted,
      reviewCount: review,
      ads: ads ? { ...ads, realProfit: costsKnown ? round(ads.revenue.value - spend - cost) : null } : null,
      realProfit: costsKnown ? round(revenue - cost - spend - other) : null,
      // Sin permiso para ver el gasto, la ganancia lo delataría (facturación − ganancia).
      profit: actor.canSeeAds
        ? signedTrend(round(revenue - spend - other - (costsKnown ? cost : 0)), round(prevRevenue - prevSpend - prevOther - (costsKnown ? prevCost : 0)))
        : null,
      otherSpend: rules.length > 0 ? { value: other, previous: prevOther, change: change(other, prevOther) } : null,
      otherExpenses: charges,
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

  /** Lo vendido por cada línea que tiene gastos en % (para cobrarlos sobre lo suyo). */
  private async lineSales(tenantId: string, rules: ReadonlyArray<ExpenseRule>, period: Period, before: Period, timezone: string) {
    const now = new Map<string, ReadonlyArray<RevenueDay>>();
    const earlier = new Map<string, ReadonlyArray<RevenueDay>>();
    await Promise.all(percentLines(rules).map(async (lineId) => {
      const scope = await this.scopes.lineScope(tenantId, lineId);
      if (!scope) return;
      const [days, prevDays] = await Promise.all([this.sales.days(tenantId, period, scope, timezone), this.sales.days(tenantId, before, scope, timezone)]);
      now.set(lineId, days);
      earlier.set(lineId, prevDays);
    }));
    return { now, before: earlier };
  }
}
