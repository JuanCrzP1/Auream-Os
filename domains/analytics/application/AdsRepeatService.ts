import { AD_LEVELS, type AdLevel, type DashboardFilters } from "../../../contracts/DashboardContracts";
import { DEFAULT_REPEAT_WINDOW, REPEAT_WINDOWS, type AdRepeatMetrics, type AdRepeatRow, type AdsRepeatResponse, type RepeatWindow } from "../../../contracts/AdsRepeatContracts";
import { CurrencyConverter, type FxRates } from "./CurrencyConverter";
import { addDays, periodOf, todayIn, type Period } from "./DashboardPeriod";
import type { AdsReader, DashboardScope } from "./DashboardReaders";
import { DashboardScopeResolver } from "./DashboardScopeResolver";
import { MoneyBook, ratio } from "./MoneyBook";
import { requestedCurrency } from "./SalesDashboardService";

// ---------------------------------------------------------------------------
// «Con recompras»: los clientes NUEVOS que trajo cada campaña, conjunto o
// anuncio en el periodo (su primera compra vino de ahí) y lo que esos mismos
// clientes volvieron a comprar dentro de la ventana (30, 60 o 90 días), con o
// sin anuncio. Cada monto con la tasa de su día. Ver `AdsRepeatContracts`.
// ---------------------------------------------------------------------------

/** Lo comprado por los clientes nuevos de cada anuncio, por día y moneda. */
export interface CohortMoneyDay {
  readonly id: string;
  readonly kind: "first" | "repeat";
  readonly day: string;
  readonly currency: string;
  readonly amount: number;
}

/** Cuántos clientes nuevos trajo cada anuncio y cuántos de ellos recompraron. */
export interface CohortCount {
  readonly id: string;
  readonly newCustomers: number;
  readonly repeatCustomers: number;
}

export interface RepeatPurchasesReader {
  money(tenantId: string, period: Period, level: AdLevel, windowDays: number, timezone: string, scope?: DashboardScope): Promise<ReadonlyArray<CohortMoneyDay>>;
  counts(tenantId: string, period: Period, level: AdLevel, windowDays: number, scope?: DashboardScope): Promise<ReadonlyArray<CohortCount>>;
}

/** Desde cuánto «mejora mucho» con las recompras: su ROAS a N días es al menos un 25 % mayor. */
const LIFT = 1.25;

interface Acc { spend: number; newCustomers: number; firstRevenue: number; repeatCustomers: number; repeatRevenue: number }
const empty = (): Acc => ({ spend: 0, newCustomers: 0, firstRevenue: 0, repeatCustomers: 0, repeatRevenue: 0 });
const round = (value: number) => Math.round(value * 100) / 100;

export function windowOf(value: unknown): RepeatWindow {
  const days = Number(value);
  return (REPEAT_WINDOWS as ReadonlyArray<number>).includes(days) ? (days as RepeatWindow) : DEFAULT_REPEAT_WINDOW;
}

function metrics(acc: Acc): AdRepeatMetrics {
  return {
    spend: round(acc.spend),
    newCustomers: acc.newCustomers,
    firstRevenue: round(acc.firstRevenue),
    newRoas: ratio(acc.firstRevenue, acc.spend),
    repeatCustomers: acc.repeatCustomers,
    repeatRevenue: round(acc.repeatRevenue),
    windowRoas: ratio(acc.firstRevenue + acc.repeatRevenue, acc.spend)
  };
}

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

export class AdsRepeatService {
  public constructor(
    private readonly ads: AdsReader,
    private readonly repeats: RepeatPurchasesReader,
    private readonly fx: FxRates,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly now: () => Date = () => new Date(),
    private readonly scopes: DashboardScopeResolver = new DashboardScopeResolver()
  ) {}

  public async repeat(tenantId: string, filters: DashboardFilters, levelInput: string | undefined, windowInput: unknown): Promise<AdsRepeatResponse> {
    const level: AdLevel = AD_LEVELS.includes(levelInput as AdLevel) ? (levelInput as AdLevel) : "campaign";
    const window = windowOf(windowInput);
    const timezone = await this.timezoneOf(tenantId);
    const period = periodOf(filters.from, filters.to, timezone, this.now());
    const today = todayIn(this.now(), timezone);
    const maturingDays = Math.max(0, dayNumber(addDays(period.toDay, window)) - dayNumber(today));
    const scope = await this.scopes.resolve(tenantId, filters);
    const status = await this.ads.status(tenantId, scope);
    if (status.accounts === 0 || scope.withoutCampaigns) {
      const base = { currency: status.mainCurrency ?? "USD", level, window, rows: [], totals: metrics(empty()), maturingDays, lastSyncedAt: status.lastSyncedAt };
      return status.accounts === 0 ? { ...base, connected: false } : { ...base, connected: true, lineWithoutCampaigns: true };
    }

    await this.fx.refresh();
    const [rates, spendDays, money, counts] = await Promise.all([
      // Las recompras pueden caer después del periodo: tasas hasta hoy.
      this.fx.table(period.fromDay, today),
      this.ads.entityDays(tenantId, period, level, scope),
      this.repeats.money(tenantId, period, level, window, timezone, scope),
      this.repeats.counts(tenantId, period, level, window, scope)
    ]);
    const converter = new CurrencyConverter(rates);
    const book = new MoneyBook(converter, requestedCurrency(filters.currency, converter) ?? status.mainCurrency ?? "USD");
    const byId = new Map<string, Acc>();
    const at = (id: string) => byId.get(id) ?? byId.set(id, empty()).get(id)!;
    for (const d of spendDays) at(d.id).spend += book.convert(d.spend, d.currency, d.day);
    for (const m of money) {
      const acc = at(m.id);
      const amount = book.convert(m.amount, m.currency, m.day);
      if (m.kind === "first") acc.firstRevenue += amount;
      else acc.repeatRevenue += amount;
    }
    for (const c of counts) {
      const acc = at(c.id);
      acc.newCustomers += c.newCustomers;
      acc.repeatCustomers += c.repeatCustomers;
    }

    const info = new Map((await this.ads.entities(tenantId, level, [...byId.keys()])).map((entity) => [entity.id, entity]));
    const rows: AdRepeatRow[] = [...byId].map(([id, acc]) => {
      const m = metrics(acc);
      const entity = info.get(id);
      return {
        id,
        name: entity?.name ?? `Anuncio ${id}`,
        level,
        status: entity?.status ?? "UNKNOWN",
        parentName: entity?.parentName ?? null,
        thumbnailUrl: entity?.thumbnailUrl ?? null,
        ...m,
        lifted: m.repeatRevenue > 0 && m.newRoas !== null && m.windowRoas !== null && m.windowRoas >= m.newRoas * LIFT
      };
    });
    rows.sort((a, b) => b.spend - a.spend || b.firstRevenue + b.repeatRevenue - (a.firstRevenue + a.repeatRevenue));
    const total = [...byId.values()].reduce((sum, acc) => {
      for (const key of Object.keys(sum) as Array<keyof Acc>) sum[key] += acc[key];
      return sum;
    }, empty());

    return { currency: book.currency, level, window, rows, totals: metrics(total), maturingDays, lastSyncedAt: status.lastSyncedAt, connected: true };
  }
}
