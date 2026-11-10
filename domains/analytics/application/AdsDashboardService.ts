import { AD_LEVELS, type AdLevel, type AdPerformanceRow, type AdsDashboardResponse, type DashboardFilters } from "../../../contracts/DashboardContracts";
import { adviceFor } from "../domain/adAdvice";
import { CurrencyConverter, type FxRates } from "./CurrencyConverter";
import { periodOf } from "./DashboardPeriod";
import type { AdsReader } from "./DashboardReaders";
import { MoneyBook, ratio, round } from "./MoneyBook";

// ---------------------------------------------------------------------------
// Dashboard › Anuncios: cada campaña, conjunto o anuncio con lo que gastó
// (Meta) y lo que vendió DE VERDAD (las ventas que llegaron con ese anuncio),
// frente a lo que cree Meta, y qué hacer con cada uno. En la moneda de la
// cuenta con más gasto.
// ---------------------------------------------------------------------------

type Totals = AdsDashboardResponse["totals"];

interface Acc {
  spend: number; impressions: number; clicks: number; chats: number; metaPurchases: number; metaRevenue: number;
  sales: number; revenue: number; late: number;
}

const empty = (): Acc => ({ spend: 0, impressions: 0, clicks: 0, chats: 0, metaPurchases: 0, metaRevenue: 0, sales: 0, revenue: 0, late: 0 });

function metrics(acc: Acc): Totals {
  return {
    spend: round(acc.spend),
    impressions: acc.impressions,
    clicks: acc.clicks,
    chats: acc.chats,
    sales: acc.sales,
    metaPurchases: acc.metaPurchases,
    revenue: round(acc.revenue),
    metaRevenue: round(acc.metaRevenue),
    profit: round(acc.revenue - acc.spend),
    roas: ratio(acc.revenue, acc.spend),
    roasMeta: ratio(acc.metaRevenue, acc.spend),
    costPerChat: acc.chats > 0 ? round(acc.spend / acc.chats) : null,
    costPerSale: acc.sales > 0 ? round(acc.spend / acc.sales) : null,
    ctr: acc.impressions > 0 ? Math.round((acc.clicks / acc.impressions) * 10000) / 10000 : null
  };
}

export class AdsDashboardService {
  public constructor(
    private readonly ads: AdsReader,
    private readonly fx: FxRates,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async performance(tenantId: string, filters: DashboardFilters, levelInput: string | undefined): Promise<AdsDashboardResponse> {
    const level: AdLevel = AD_LEVELS.includes(levelInput as AdLevel) ? (levelInput as AdLevel) : "campaign";
    const timezone = await this.timezoneOf(tenantId);
    const period = periodOf(filters.from, filters.to, timezone, this.now());
    const status = await this.ads.status(tenantId);
    if (status.accounts === 0) {
      return { currency: status.mainCurrency ?? "USD", level, rows: [], totals: metrics(empty()), unseenSales: 0, lateShare: null, lastSyncedAt: status.lastSyncedAt, connected: false };
    }
    await this.fx.refresh();
    const [rates, days, sold] = await Promise.all([
      this.fx.table(period.fromDay, period.toDay),
      this.ads.entityDays(tenantId, period, level),
      this.ads.attributed(tenantId, period, level, timezone)
    ]);
    const book = new MoneyBook(new CurrencyConverter(rates), status.mainCurrency ?? "USD");
    const byId = new Map<string, Acc>();
    const at = (id: string) => byId.get(id) ?? byId.set(id, empty()).get(id)!;
    for (const d of days) {
      const acc = at(d.id);
      acc.spend += book.convert(d.spend, d.currency, d.day);
      acc.metaRevenue += book.convert(d.metaRevenue, d.currency, d.day);
      acc.impressions += d.impressions;
      acc.clicks += d.clicks;
      acc.chats += d.conversations;
      acc.metaPurchases += d.metaPurchases;
    }
    for (const s of sold) {
      const acc = at(s.id);
      acc.revenue += book.convert(s.amount, s.currency, s.day);
      acc.sales += s.count;
      acc.late += s.late;
    }
    const total = [...byId.values()].reduce((sum, acc) => {
      for (const key of Object.keys(sum) as Array<keyof Acc>) sum[key] += acc[key];
      return sum;
    }, empty());
    const accountCostPerSale = total.sales > 0 ? total.spend / total.sales : null;
    const info = new Map((await this.ads.entities(tenantId, level, [...byId.keys()])).map((entity) => [entity.id, entity]));

    const rows: AdPerformanceRow[] = [...byId].map(([id, acc]) => {
      const m = metrics(acc);
      const entity = info.get(id);
      const advice = adviceFor({ spend: acc.spend, sales: acc.sales, chats: acc.chats, roas: m.roas, accountCostPerSale });
      return {
        id,
        name: entity?.name ?? `Anuncio ${id}`,
        level,
        status: entity?.status ?? "UNKNOWN",
        parentName: entity?.parentName ?? null,
        dailyBudget: entity?.dailyBudget ?? null,
        thumbnailUrl: entity?.thumbnailUrl ?? null,
        ...m,
        advice: advice.advice,
        adviceReason: advice.reason
      };
    });
    rows.sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);

    return {
      currency: book.currency,
      level,
      rows,
      totals: metrics(total),
      unseenSales: Math.max(0, total.sales - total.metaPurchases),
      lateShare: total.sales > 0 ? Math.round((total.late / total.sales) * 100) / 100 : null,
      lastSyncedAt: status.lastSyncedAt,
      connected: true
    };
  }
}
