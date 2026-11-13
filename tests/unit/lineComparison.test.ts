import { describe, expect, it } from "vitest";
import type { FxRates } from "../../domains/analytics/application/CurrencyConverter.js";
import type { AdsReader, DashboardScope, SalesReader } from "../../domains/analytics/application/DashboardReaders.js";
import { DashboardScopeResolver } from "../../domains/analytics/application/DashboardScopeResolver.js";
import { LineComparisonService, type LineInfo } from "../../domains/analytics/application/LineComparisonService.js";
import type { ExpenseRule } from "../../domains/analytics/application/OtherExpenseLedger.js";
import { SalesDashboardService } from "../../domains/analytics/application/SalesDashboardService.js";

// ---------------------------------------------------------------------------
// Comparar líneas: cada línea con su facturación, el gasto de SUS campañas,
// su ROAS real, sus otros gastos y su ganancia; todo el negocio al final, con
// los mismos números que el Dashboard sin línea. Una línea sin campañas no
// carga el gasto de todo el negocio.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-11-10T22:00:00.000Z");
const fx: FxRates = { table: async () => new Map([["2026-09-01", new Map([["COP", 4000]])]]), refresh: async () => {} };
const tz = async () => "America/Bogota";
const PA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LA = "11111111-1111-4111-8111-111111111111";
const LB = "22222222-2222-4222-8222-222222222222";
const LC = "33333333-3333-4333-8333-333333333333";
const current = (toDay: string) => toDay === "2026-11-10";

// Producto A vende 500.000 (400.000 por anuncios), B 200.000 y otro producto 100.000 orgánico. Antes, la mitad.
const sold = (scope: DashboardScope) => (scope.productIds?.includes(PA) ? [500_000, 400_000, 5] : scope.productIds?.includes(PB) ? [200_000, 0, 2] : [800_000, 400_000, 8]);
const sales: SalesReader = {
  days: async (_t, period, scope) => {
    const [amount, adAmount, count] = sold(scope).map((n) => (current(period.toDay) ? n! : n! / 2));
    return [{ day: current(period.toDay) ? "2026-11-02" : "2026-10-02", currency: "COP", amount: amount!, count: count!, adAmount: adAmount!, adCount: 1, cost: 0, withoutCost: count! }];
  },
  byHour: async () => Array.from({ length: 24 }, () => 0),
  breakdown: async () => [],
  leads: async () => ({ total: 10, fromAds: 5, converted: 2 }),
  reviewCount: async () => 0,
  recent: async () => []
};

const spent: string[] = [];
const ads: AdsReader = {
  status: async () => ({ accounts: 1, lastSyncedAt: null, mainCurrency: "COP", activeCampaigns: 1 }),
  spend: async (_t, period, scope) => {
    spent.push(scope?.campaignIds?.join(",") ?? "todo");
    const value = scope?.campaignIds?.includes("111") ? (current(period.toDay) ? 100_000 : 80_000) : current(period.toDay) ? 150_000 : 100_000;
    return [{ day: current(period.toDay) ? "2026-11-02" : "2026-10-02", currency: "COP", spend: value, impressions: 0, clicks: 0, conversations: 0, metaPurchases: 0, metaRevenue: 0 }];
  },
  entityDays: async () => [],
  entities: async () => [],
  attributed: async () => [],
  arrivals: async () => [],
  recordsSales: async () => true
};

const line = (id: string, name: string, productIds: string[], campaignIds: string[]): LineInfo => ({ id, name, color: "#6c4fe0", productIds, connectionIds: [], campaignIds });
const LINES = [line(LB, "Colombia", [PB], []), line(LA, "Venezuela", [PA], ["111"])];
const rules: ExpenseRule[] = [
  { id: "comision", name: "Comisión", kind: "percent", amount: 10, currency: null, frequency: null, startsOn: "2026-10-01", endsOn: null, lineId: LB },
  { id: "flyers", name: "Flyers", kind: "fixed", amount: 50_000, currency: "COP", frequency: "once", startsOn: "2026-11-05", endsOn: null, lineId: null }
];
const compare = (lines: LineInfo[], canSeeAds = true) =>
  new LineComparisonService(sales, ads, fx, tz, { list: async () => lines }, { list: async () => rules }, () => NOW).compare({ tenantId: "t", canSeeAds }, {});

describe("comparar líneas", () => {
  it("cada línea con su gasto, ROAS, otros gastos y ganancia, de la que más gana a la que menos", async () => {
    spent.length = 0;
    const view = await compare(LINES);
    expect(view.rows.map((row) => row.name)).toEqual(["Venezuela", "Colombia"]);
    expect(view.rows[0]).toMatchObject({
      id: LA, revenue: { value: 500_000, previous: 250_000, change: 1 }, sales: 5, averageTicket: 100_000, share: 0.63,
      hasCampaigns: true, spend: 100_000, roas: 4, otherSpend: 0, profit: { value: 400_000, previous: 170_000 }, margin: 0.8
    });
    // Sin campañas no se sabe su gasto (nunca el de todo el negocio); su comisión es 10 % de lo suyo.
    expect(view.rows[1]).toMatchObject({ id: LB, hasCampaigns: false, spend: null, roas: null, otherSpend: 20_000, profit: { value: 180_000, previous: 90_000 }, share: 0.25 });
    expect(spent).not.toContain("");
    // Todo el negocio: 800.000 − 150.000 de Meta − flyers 50.000 − comisión 20.000 (10 % de lo de Colombia, no de todo).
    expect(view.total).toMatchObject({ id: null, name: "Todo el negocio", revenue: { value: 800_000 }, spend: 150_000, otherSpend: 70_000, profit: { value: 580_000, previous: 290_000 }, share: 1 });
    expect(view).toMatchObject({ currency: "COP", overlapping: false, canSeeAds: true });
  });

  it("el total es el mismo que muestra el Dashboard sin línea (también el % de una línea)", async () => {
    const lookup = { scopeOf: async (_t: string, id: string) => LINES.find((item) => item.id === id) ?? null };
    const overview = await new SalesDashboardService(sales, ads, fx, tz, () => NOW, new DashboardScopeResolver(lookup), { list: async () => rules }).overview({ tenantId: "t", canSeeAds: true }, {});
    const view = await compare(LINES);
    expect(overview.otherSpend?.value).toBe(view.total.otherSpend);
    expect(overview.profit).toEqual(view.total.profit);
    expect(overview.revenue).toEqual(view.total.revenue);
  });

  it("sin permiso para ver el gasto: ni gasto, ni ganancia, ni otros gastos; se ordena por facturación", async () => {
    const view = await compare(LINES, false);
    expect(view.rows.map((row) => row.name)).toEqual(["Venezuela", "Colombia"]);
    for (const row of [...view.rows, view.total]) expect(row).toMatchObject({ spend: null, roas: null, otherSpend: null, profit: null, margin: null });
    expect(view.rows[0]!.revenue.value).toBe(500_000);
  });

  it("avisa si las líneas se pisan (un producto en dos líneas)", async () => {
    const view = await compare([...LINES, line(LC, "Venezuela VIP", [PA], ["111"])]);
    expect(view.overlapping).toBe(true);
  });

  it("sin líneas: solo todo el negocio", async () => {
    const view = await compare([]);
    expect(view.rows).toEqual([]);
    expect(view.total.revenue.value).toBe(800_000);
  });
});
