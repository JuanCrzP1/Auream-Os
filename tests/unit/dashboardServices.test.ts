import { describe, expect, it } from "vitest";
import { AdsDashboardService } from "../../domains/analytics/application/AdsDashboardService.js";
import { CurrencyConverter, type FxRates } from "../../domains/analytics/application/CurrencyConverter.js";
import { periodOf, previousPeriod } from "../../domains/analytics/application/DashboardPeriod.js";
import type { AdsReader, SalesReader } from "../../domains/analytics/application/DashboardReaders.js";
import { SalesDashboardService } from "../../domains/analytics/application/SalesDashboardService.js";
import { DashboardScopeResolver } from "../../domains/analytics/application/DashboardScopeResolver.js";

// ---------------------------------------------------------------------------
// Las cuentas del Dashboard: el periodo en la hora de la empresa, el cambio de
// moneda del día (sin inventar si falta), el ROAS real frente al de Meta, la
// ganancia (y la real con el costo de los productos) y qué hacer con cada campaña.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-11-10T22:00:00.000Z");
const rates = new Map([["2026-11-01", new Map([["COP", 4000], ["MXN", 20]])]]);
const fx: FxRates = { table: async () => rates, refresh: async () => {} };
const tz = async () => "America/Bogota";

describe("periodo y monedas", () => {
  it("los últimos 30 días hasta hoy en la hora de la empresa, y el periodo anterior del mismo largo", () => {
    const period = periodOf(undefined, undefined, "America/Bogota", NOW);
    expect(period).toMatchObject({ fromDay: "2026-10-12", toDay: "2026-11-10", days: 30 });
    expect(period.from.toISOString()).toBe("2026-10-12T05:00:00.000Z");
    expect(previousPeriod(period, "America/Bogota")).toMatchObject({ fromDay: "2026-09-12", toDay: "2026-10-11" });
    expect(() => periodOf("2026-11-10", "2026-11-01", "America/Bogota", NOW)).toThrow("La fecha inicial va antes de la final.");
  });

  it("convierte con la tasa más cercana anterior (o la siguiente) y no inventa una que no existe", () => {
    const converter = new CurrencyConverter(new Map([["2026-11-01", new Map([["COP", 4000]])], ["2026-11-05", new Map([["COP", 4100]])]]));
    expect(converter.convert(10, "USD", "COP", "2026-11-03")).toBe(40000);
    expect(converter.convert(10, "USD", "COP", "2026-10-01")).toBe(40000);
    expect(converter.convert(8200, "COP", "USD", "2026-11-09")).toBe(2);
    expect(converter.convert(1, "VES", "COP", "2026-11-05")).toBeNull();
  });
});

const salesReader = (overrides: Partial<SalesReader> = {}): SalesReader => ({
  days: async (_t, period) => (period.toDay === "2026-11-10"
    ? [
        { day: "2026-11-02", currency: "COP", amount: 400000, count: 8, adAmount: 300000, adCount: 6, cost: 100000, withoutCost: 0 },
        { day: "2026-11-03", currency: "USD", amount: 50, count: 4, adAmount: 50, adCount: 4, cost: 10, withoutCost: 0 }
      ]
    : [{ day: "2026-10-02", currency: "COP", amount: 300000, count: 6, adAmount: 200000, adCount: 4, cost: 60000, withoutCost: 0 }]),
  byHour: async () => Array.from({ length: 24 }, () => 0),
  breakdown: async () => [],
  leads: async (_t, period) => (period.toDay === "2026-11-10" ? { total: 60, fromAds: 40, converted: 9 } : { total: 50, fromAds: 30, converted: 5 }),
  reviewCount: async () => 2,
  recent: async () => [],
  ...overrides
});

const adsReader = (accounts = 1, overrides: Partial<AdsReader> = {}): AdsReader => ({
  status: async () => ({ accounts, lastSyncedAt: "2026-11-10T20:00:00.000Z", mainCurrency: accounts ? "COP" : null, activeCampaigns: 3 }),
  spend: async (_t, period) => (period.toDay === "2026-11-10"
    ? [{ day: "2026-11-02", currency: "COP", spend: 100000, impressions: 20000, clicks: 600, conversations: 40, metaPurchases: 3, metaRevenue: 150000 }]
    : [{ day: "2026-10-02", currency: "COP", spend: 80000, impressions: 15000, clicks: 400, conversations: 30, metaPurchases: 2, metaRevenue: 90000 }]),
  entityDays: async () => [
    { id: "c1", day: "2026-11-02", currency: "COP", spend: 80000, impressions: 15000, clicks: 500, conversations: 30, metaPurchases: 3, metaRevenue: 150000 },
    { id: "c2", day: "2026-11-02", currency: "COP", spend: 20000, impressions: 5000, clicks: 100, conversations: 16, metaPurchases: 0, metaRevenue: 0 }
  ],
  entities: async () => [{ id: "c1", name: "Video Colombia", status: "ACTIVE", parentName: null, dailyBudget: 15000, thumbnailUrl: null }],
  attributed: async () => [
    { id: "c1", day: "2026-11-02", currency: "COP", amount: 300000, count: 6, late: 2 },
    { id: "c1", day: "2026-11-03", currency: "USD", amount: 50, count: 4, late: 0 }
  ],
  // A Auream llegan casi todos los chats que cobra Meta, y el negocio anota sus ventas.
  arrivals: async () => [{ id: "c1", chats: 28 }, { id: "c2", chats: 14 }],
  recordsSales: async () => true,
  ...overrides
});

describe("SalesDashboardService", () => {
  it("todo en la moneda de la cuenta de anuncios: ROAS real frente al de Meta, ganancia y la real con el costo", async () => {
    const service = new SalesDashboardService(salesReader(), adsReader(), fx, tz, () => NOW);
    const view = await service.overview({ tenantId: "t", canSeeAds: true }, {});
    expect(view.currency).toBe("COP");
    expect(view.revenue).toEqual({ value: 600000, previous: 300000, change: 1 });
    expect(view.sales.value).toBe(12);
    // Conversión: de los 60 leads nuevos, 9 compraron (no 12 ventas ÷ 60: esas incluyen clientes viejos).
    expect([view.conversion, view.conversionPrevious, view.convertedLeads]).toEqual([0.15, 0.1, 9]);
    expect(view.ads).toMatchObject({
      spend: { value: 100000 }, revenue: { value: 500000 }, profit: { value: 400000 },
      roas: 5, roasMeta: 1.5, costPerSale: 10000, costPerChat: 2500, chats: 40, attributedSales: 10,
      measurement: { state: "measured", metaChats: 40, arrivedChats: 42, metaPurchases: 3 }
    });
    // Ganancia real: 600.000 vendido − 140.000 de costo − 100.000 de anuncios.
    expect(view.realProfit).toBe(360000);
    // Ganancia del resumen: igual, frente a 300.000 − 60.000 − 80.000 del periodo anterior.
    expect(view.profit).toEqual({ value: 360000, previous: 160000, change: 1.25 });
    expect(view.funnel).toEqual({ impressions: 20000, clicks: 600, chats: 40, sales: 10 });
    expect(view.daily.find((d) => d.day === "2026-11-02")).toEqual({ day: "2026-11-02", revenue: 400000, spend: 100000 });
  });

  it("sin permiso para ver el gasto no hay nada de anuncios; sin costos no hay ganancia real", async () => {
    const reader = salesReader({ days: async () => [{ day: "2026-11-02", currency: "COP", amount: 1000, count: 1, adAmount: 0, adCount: 0, cost: 0, withoutCost: 1 }] });
    const view = await new SalesDashboardService(reader, adsReader(), fx, tz, () => NOW).overview({ tenantId: "t", canSeeAds: false }, {});
    expect(view).toMatchObject({ ads: null, funnel: null, realProfit: null, profit: null, costsKnown: false, canSeeAds: false });
  });

  it("una moneda sin tasa no se suma y se avisa", async () => {
    const reader = salesReader({ days: async () => [{ day: "2026-11-02", currency: "VES", amount: 999, count: 1, adAmount: 0, adCount: 0, cost: 0, withoutCost: 1 }, { day: "2026-11-02", currency: "COP", amount: 1000, count: 1, adAmount: 0, adCount: 0, cost: 0, withoutCost: 1 }] });
    const view = await new SalesDashboardService(reader, adsReader(0), fx, tz, () => NOW).overview({ tenantId: "t", canSeeAds: true }, {});
    expect(view).toMatchObject({ currency: "COP", missingRates: ["VES"], ads: null });
    expect(view.revenue.value).toBe(1000);
  });
});

describe("AdsDashboardService", () => {
  it("cada campaña con su venta real frente a lo de Meta, las ventas que Meta no vio y qué hacer", async () => {
    const view = await new AdsDashboardService(adsReader(), fx, tz, () => NOW).performance("t", {}, "campaign");
    const [video, other] = view.rows;
    expect(video).toMatchObject({ id: "c1", name: "Video Colombia", spend: 80000, sales: 10, revenue: 500000, roas: 6.25, roasMeta: 1.88, advice: "scale" });
    expect(other).toMatchObject({ id: "c2", name: "Anuncio c2", sales: 0, chats: 16, advice: "pause" });
    expect(view.totals).toMatchObject({ spend: 100000, revenue: 500000, profit: 400000, roas: 5, costPerSale: 10000 });
    expect(view).toMatchObject({ unseenSales: 7, lateShare: 0.2, connected: true, currency: "COP", measurement: { state: "measured", metaChats: 46, arrivedChats: 42 } });
    expect([video!.arrivedChats, other!.arrivedChats]).toEqual([28, 14]);
  });

  it("sin cuentas conectadas responde vacío y lo dice", async () => {
    expect(await new AdsDashboardService(adsReader(0), fx, tz, () => NOW).performance("t", {}, "ad")).toMatchObject({ connected: false, rows: [], level: "ad" });
  });
});

describe("una línea sin campañas", () => {
  const LINE = "55555555-5555-4555-8555-555555555555";
  const scopes = new DashboardScopeResolver({ scopeOf: async () => ({ productIds: ["11111111-1111-4111-8111-111111111111"], connectionIds: [], campaignIds: [] }) });

  it("no carga el gasto de todo el negocio: sus ventas sí, su gasto en Meta no se conoce y no se resta de su ganancia", async () => {
    const view = await new SalesDashboardService(salesReader(), adsReader(), fx, tz, () => NOW, scopes).overview({ tenantId: "t", canSeeAds: true }, { lineId: LINE });
    expect(view.revenue.value).toBe(600000);
    expect(view.ads).toBeNull();
    expect(view.lineWithoutCampaigns).toBe(true);
    const all = await new SalesDashboardService(salesReader(), adsReader(), fx, tz, () => NOW, scopes).overview({ tenantId: "t", canSeeAds: true }, {});
    expect(all.lineWithoutCampaigns).toBeUndefined();
    expect(all.ads?.spend.value).toBe(100000);
    // Su ganancia solo resta el costo de los productos: los 100.000 de Meta de todo el negocio no son suyos.
    expect(view.profit!.value - all.profit!.value).toBe(100000);
  });

  it("en Anuncios no muestra las campañas de todo el negocio", async () => {
    const view = await new AdsDashboardService(adsReader(), fx, tz, () => NOW, scopes).performance("t", { lineId: LINE }, "campaign");
    expect(view).toMatchObject({ connected: true, lineWithoutCampaigns: true, rows: [], totals: { spend: 0 } });
  });
});
