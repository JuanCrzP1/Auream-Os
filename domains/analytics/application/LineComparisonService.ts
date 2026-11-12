import type { DashboardFilters } from "../../../contracts/DashboardContracts";
import type { LineComparisonResponse, LineComparisonRow } from "../../../contracts/LineComparisonContracts";
import { CurrencyConverter, type FxRates } from "./CurrencyConverter";
import { periodOf, previousPeriod, todayIn, type Period } from "./DashboardPeriod";
import type { AdsReader, DashboardScope, SalesDay, SalesReader } from "./DashboardReaders";
import type { LineScope } from "./DashboardScopeResolver";
import { MoneyBook, mostUsedCurrency } from "./MoneyBook";
import { chargesOf, revenueBase, rulesFor, totalOf, type ExpenseRule, type OtherExpensesReader, type RevenueBase } from "./OtherExpenseLedger";
import { lineRow, rankRows, sumsOverflow, type LineNumbers } from "./LineComparisonRows";
import { requestedCurrency, type DashboardActor } from "./SalesDashboardService";

// ---------------------------------------------------------------------------
// Dashboard › Comparar líneas: cada línea de venta con lo mismo que muestra el
// Dashboard al elegirla (facturación, gasto de sus campañas, ROAS real, otros
// gastos y ganancia), en el mismo periodo y moneda, y todo el negocio al
// final. Una línea sin campañas no tiene gasto conocido: no se le carga el de
// todo el negocio. Solo lee.
// ---------------------------------------------------------------------------

/** Una línea con su nombre y lo que junta (lo da el módulo de líneas). */
export interface LineInfo extends LineScope {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface SalesLineDirectory {
  list(tenantId: string): Promise<ReadonlyArray<LineInfo>>;
}

const scopeOfLine = (line: LineScope): DashboardScope => ({
  ...(line.connectionIds.length ? { connectionIds: line.connectionIds } : {}),
  ...(line.productIds.length ? { productIds: line.productIds } : {}),
  ...(line.campaignIds.length ? { campaignIds: line.campaignIds } : {})
});

export class LineComparisonService {
  public constructor(
    private readonly sales: SalesReader,
    private readonly ads: AdsReader,
    private readonly fx: FxRates,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly lines: SalesLineDirectory,
    private readonly expenses: OtherExpensesReader | null = null,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async compare(actor: DashboardActor, filters: Pick<DashboardFilters, "from" | "to" | "currency">): Promise<LineComparisonResponse> {
    const { tenantId, canSeeAds } = actor;
    const timezone = await this.timezoneOf(tenantId);
    const period = periodOf(filters.from, filters.to, timezone, this.now());
    const before = previousPeriod(period, timezone);
    await this.fx.refresh();
    const [rates, lines, status, rules] = await Promise.all([
      this.fx.table(before.fromDay, period.toDay),
      this.lines.list(tenantId),
      canSeeAds ? this.ads.status(tenantId) : Promise.resolve(null),
      canSeeAds && this.expenses ? this.expenses.list(tenantId) : Promise.resolve([] as ReadonlyArray<ExpenseRule>)
    ]);
    const withAds = status !== null && status.accounts > 0;
    const read = (scope: DashboardScope, spend: boolean) => this.numbers(tenantId, period, before, scope, timezone, spend);
    const [business, ...perLine] = await Promise.all([
      read({}, withAds),
      ...lines.map((line) => read(scopeOfLine(line), withAds && line.campaignIds.length > 0))
    ]);

    const converter = new CurrencyConverter(rates);
    const book = new MoneyBook(
      converter,
      requestedCurrency(filters.currency, converter) ?? status?.mainCurrency ?? mostUsedCurrency(business!.days.filter((d) => converter.has(d.currency))) ?? mostUsedCurrency(business!.days) ?? "USD"
    );
    const today = todayIn(this.now(), timezone);
    const other = (lineRules: ReadonlyArray<ExpenseRule>, now: RevenueBase, earlier: RevenueBase) => ({
      now: totalOf(chargesOf(lineRules, period.fromDay, period.toDay, today, book, now)),
      before: totalOf(chargesOf(lineRules, before.fromDay, before.toDay, today, book, earlier))
    });
    // El % de una línea sale de lo vendido por esa línea, también en la fila del negocio.
    const byLine = (pick: (numbers: LineNumbers) => ReadonlyArray<SalesDay>) => new Map(lines.map((line, index) => [line.id, pick(perLine[index]!)] as const));

    const totalRevenue = book.sum(business!.days, (d) => ({ amount: d.amount, currency: d.currency, day: d.day }));
    const options = { book, canSeeAds, totalRevenue };
    const total = lineRow(
      { id: null, name: "Todo el negocio", color: null, hasCampaigns: withAds },
      business!,
      other(rules, revenueBase(business!.days, byLine((n) => n.days)), revenueBase(business!.prevDays, byLine((n) => n.prevDays))),
      options
    );
    const rows: LineComparisonRow[] = lines.map((line, index) =>
      lineRow({ id: line.id, name: line.name, color: line.color, hasCampaigns: line.campaignIds.length > 0 }, perLine[index]!, other(rulesFor(rules, line.id), perLine[index]!.days, perLine[index]!.prevDays), options)
    );

    return {
      currency: book.currency,
      missingRates: book.missing,
      canSeeAds,
      rows: rankRows(rows, canSeeAds),
      total,
      overlapping: sumsOverflow(rows, total)
    };
  }

  private async numbers(tenantId: string, period: Period, before: Period, scope: DashboardScope, timezone: string, withSpend: boolean): Promise<LineNumbers> {
    const [days, prevDays, spendDays, prevSpendDays] = await Promise.all([
      this.sales.days(tenantId, period, scope, timezone),
      this.sales.days(tenantId, before, scope, timezone),
      withSpend ? this.ads.spend(tenantId, period, scope) : Promise.resolve(null),
      withSpend ? this.ads.spend(tenantId, before, scope) : Promise.resolve(null)
    ]);
    return { days: days as ReadonlyArray<SalesDay>, prevDays, spendDays, prevSpendDays };
  }
}
