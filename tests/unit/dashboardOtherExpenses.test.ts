import { describe, expect, it } from "vitest";
import type { FxRates } from "../../domains/analytics/application/CurrencyConverter.js";
import type { AdsReader, SalesReader } from "../../domains/analytics/application/DashboardReaders.js";
import { DashboardScopeResolver } from "../../domains/analytics/application/DashboardScopeResolver.js";
import type { ExpenseRule, OtherExpensesReader } from "../../domains/analytics/application/OtherExpenseLedger.js";
import { SalesDashboardService } from "../../domains/analytics/application/SalesDashboardService.js";

// ---------------------------------------------------------------------------
// Dashboard › Ventas con otros gastos: se restan de la ganancia (no del ROAS),
// solo los ve quien ve el gasto, y con una línea cuentan solo los suyos. Sin
// gastos, el Dashboard queda igual que antes.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-11-10T22:00:00.000Z");
const fx: FxRates = { table: async () => new Map([["2026-09-01", new Map([["COP", 4000]])]]), refresh: async () => {} };
const tz = async () => "America/Bogota";
const L = "22222222-2222-4222-8222-222222222222";
const current = (toDay: string) => toDay === "2026-11-10";

const sales: SalesReader = {
  days: async (_t, period) => (current(period.toDay)
    ? [{ day: "2026-11-02", currency: "COP", amount: 400_000, count: 8, adAmount: 300_000, adCount: 6, cost: 100_000, withoutCost: 0 },
       { day: "2026-11-03", currency: "USD", amount: 50, count: 4, adAmount: 50, adCount: 4, cost: 10, withoutCost: 0 }]
    : [{ day: "2026-10-02", currency: "COP", amount: 300_000, count: 6, adAmount: 200_000, adCount: 4, cost: 60_000, withoutCost: 0 }]),
  byHour: async () => Array.from({ length: 24 }, () => 0),
  breakdown: async () => [],
  leads: async () => ({ total: 10, fromAds: 5, converted: 2 }),
  reviewCount: async () => 0,
  recent: async () => []
};

const ads: AdsReader = {
  status: async () => ({ accounts: 1, lastSyncedAt: null, mainCurrency: "COP", activeCampaigns: 1 }),
  spend: async (_t, period) => [{ day: current(period.toDay) ? "2026-11-02" : "2026-10-02", currency: "COP", spend: current(period.toDay) ? 100_000 : 80_000, impressions: 0, clicks: 0, conversations: 0, metaPurchases: 0, metaRevenue: 0 }],
  entityDays: async () => [],
  entities: async () => [],
  attributed: async () => [],
  arrivals: async () => [],
  recordsSales: async () => true
};

const rules: ExpenseRule[] = [
  { id: "nomina", name: "Nómina", kind: "fixed", amount: 1_000_000, currency: "COP", frequency: "monthly", startsOn: "2026-10-01", endsOn: null, lineId: null },
  { id: "pasarela", name: "Pasarela", kind: "percent", amount: 5, currency: null, frequency: null, startsOn: "2026-11-01", endsOn: null, lineId: null },
  { id: "flyers", name: "Flyers", kind: "fixed", amount: 50_000, currency: "COP", frequency: "once", startsOn: "2026-11-05", endsOn: null, lineId: L }
];
const reader = (list: ExpenseRule[]): OtherExpensesReader => ({ list: async () => list });
const service = (list: ExpenseRule[]) => new SalesDashboardService(sales, ads, fx, tz, () => NOW, new DashboardScopeResolver(), reader(list));

describe("otros gastos en el Dashboard", () => {
  it("se restan de la ganancia y se muestran aparte; el ROAS sigue siendo solo de Meta", async () => {
    const view = await service(rules).overview({ tenantId: "t", canSeeAds: true }, {});
    // Nómina 1.000.000 (el 1 de nov) + 5 % de 600.000 vendidos (30.000) + flyers 50.000; antes: la nómina del 1 de oct.
    expect(view.otherSpend).toEqual({ value: 1_080_000, previous: 1_000_000, change: 0.08 });
    expect(view.otherExpenses).toEqual([
      { id: "nomina", name: "Nómina", amount: 1_000_000 },
      { id: "pasarela", name: "Pasarela", amount: 30_000 },
      { id: "flyers", name: "Flyers", amount: 50_000 }
    ]);
    // 600.000 − 100.000 de Meta − 1.080.000 de otros − 140.000 de costo; antes 300.000 − 80.000 − 1.000.000 − 60.000.
    expect(view.profit).toMatchObject({ value: -720_000, previous: -840_000 });
    expect(view.realProfit).toBe(-720_000);
    expect(view.ads?.roas).toBe(5);
  });

  it("con una línea, solo cuentan sus gastos", async () => {
    const view = await service(rules).overview({ tenantId: "t", canSeeAds: true }, { lineId: L });
    expect(view.otherExpenses.map((e) => e.id)).toEqual(["flyers"]);
    expect(view.otherSpend?.value).toBe(50_000);
  });

  it("sin gastos o sin permiso para ver el gasto, todo queda como antes", async () => {
    const none = await service([]).overview({ tenantId: "t", canSeeAds: true }, {});
    expect(none).toMatchObject({ otherSpend: null, otherExpenses: [], profit: { value: 360_000 } });
    const hidden = await service(rules).overview({ tenantId: "t", canSeeAds: false }, {});
    expect(hidden).toMatchObject({ otherSpend: null, otherExpenses: [], profit: null });
  });
});
