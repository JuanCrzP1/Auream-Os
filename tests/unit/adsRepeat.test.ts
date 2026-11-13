import { describe, expect, it, vi } from "vitest";
import type { FxRates } from "../../domains/analytics/application/CurrencyConverter.js";
import type { AdsReader } from "../../domains/analytics/application/DashboardReaders.js";
import { AdsRepeatService, windowOf, type RepeatPurchasesReader } from "../../domains/analytics/application/AdsRepeatService.js";
import { DashboardScopeResolver } from "../../domains/analytics/application/DashboardScopeResolver.js";

// ---------------------------------------------------------------------------
// «Con recompras»: los clientes nuevos de cada campaña y lo que volvieron a
// comprar dentro de la ventana; ROAS de nuevos frente a ROAS a N días, la
// marca de los que mejoran mucho, cuánto falta para que el periodo «madure»
// y, como el resto del Dashboard, cada monto con la tasa de su día.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-11-12T22:00:00.000Z");
const fx: FxRates = { table: async () => new Map([["2026-10-01", new Map([["COP", 4000]])]]), refresh: async () => {} };
const tz = async () => "America/Bogota";

const ads = (accounts = 1): AdsReader => ({
  status: async () => ({ accounts, lastSyncedAt: "2026-11-12T20:00:00.000Z", mainCurrency: "COP", activeCampaigns: 2 }),
  spend: async () => [],
  entityDays: async () => [
    { id: "c1", day: "2026-10-05", currency: "COP", spend: 400000, impressions: 0, clicks: 0, conversations: 0, metaPurchases: 0, metaRevenue: 0 },
    { id: "c2", day: "2026-10-05", currency: "COP", spend: 300000, impressions: 0, clicks: 0, conversations: 0, metaPurchases: 0, metaRevenue: 0 }
  ],
  entities: async () => [{ id: "c1", name: "Video Colombia · Mamás", status: "ACTIVE", parentName: null, dailyBudget: null, thumbnailUrl: null }],
  attributed: async () => []
});

const repeats = (): RepeatPurchasesReader => ({
  money: vi.fn(async () => [
    { id: "c1", kind: "first" as const, day: "2026-10-05", currency: "COP", amount: 600000 },
    { id: "c1", kind: "repeat" as const, day: "2026-11-02", currency: "USD", amount: 50 },
    { id: "c1", kind: "repeat" as const, day: "2026-11-03", currency: "COP", amount: 150000 },
    { id: "c2", kind: "first" as const, day: "2026-10-06", currency: "COP", amount: 450000 }
  ]),
  counts: vi.fn(async () => [
    { id: "c1", newCustomers: 12, repeatCustomers: 5 },
    { id: "c2", newCustomers: 10, repeatCustomers: 0 }
  ])
});

describe("ventana de recompras", () => {
  it("30, 60 o 90 días; cualquier otra cosa, 60", () => {
    expect([windowOf("30"), windowOf(90), windowOf("45"), windowOf(undefined), windowOf("abc")]).toEqual([30, 90, 60, 60, 60]);
  });
});

describe("AdsRepeatService", () => {
  it("clientes nuevos, primera compra, recompras en la moneda de la cuenta y los dos ROAS; marca a los que mejoran mucho", async () => {
    const reader = repeats();
    const view = await new AdsRepeatService(ads(), reader, fx, tz, () => NOW).repeat("t", { from: "2026-10-01", to: "2026-10-31" }, "campaign", "60");
    expect(view).toMatchObject({ currency: "COP", level: "campaign", window: 60, connected: true });
    const [c1, c2] = view.rows;
    expect(c1).toMatchObject({
      id: "c1", name: "Video Colombia · Mamás", spend: 400000, newCustomers: 12, firstRevenue: 600000, newRoas: 1.5,
      repeatCustomers: 5, repeatRevenue: 350000, windowRoas: 2.38, lifted: true
    });
    expect(c2).toMatchObject({ id: "c2", name: "Anuncio c2", newRoas: 1.5, repeatRevenue: 0, windowRoas: 1.5, lifted: false });
    expect(view.totals).toMatchObject({ spend: 700000, newCustomers: 22, firstRevenue: 1050000, repeatCustomers: 5, repeatRevenue: 350000, windowRoas: 2 });
    expect(reader.money).toHaveBeenCalledWith("t", expect.objectContaining({ fromDay: "2026-10-01", toDay: "2026-10-31" }), "campaign", 60, "America/Bogota", {});
  });

  it("dice cuántos días faltan para que todos los clientes del periodo cumplan la ventana", async () => {
    const service = new AdsRepeatService(ads(), repeats(), fx, tz, () => NOW);
    // Clientes hasta el 31 de oct + 60 días = 30 de dic; hoy es 12 de nov: faltan 48.
    expect((await service.repeat("t", { from: "2026-10-01", to: "2026-10-31" }, "campaign", "60")).maturingDays).toBe(48);
    expect((await service.repeat("t", { from: "2026-08-01", to: "2026-08-31" }, "campaign", "30")).maturingDays).toBe(0);
  });

  it("sin cuentas conectadas, o con una línea sin campañas, no muestra nada (nunca lo de todo el negocio)", async () => {
    expect(await new AdsRepeatService(ads(0), repeats(), fx, tz, () => NOW).repeat("t", {}, undefined, undefined)).toMatchObject({ connected: false, rows: [], window: 60 });
    const scopes = new DashboardScopeResolver({ scopeOf: async () => ({ productIds: [], connectionIds: [], campaignIds: [] }) });
    const reader = repeats();
    const view = await new AdsRepeatService(ads(), reader, fx, tz, () => NOW, scopes).repeat("t", { lineId: "55555555-5555-4555-8555-555555555555" }, "ad", "30");
    expect(view).toMatchObject({ connected: true, lineWithoutCampaigns: true, rows: [], level: "ad", window: 30 });
    expect(reader.money).not.toHaveBeenCalled();
  });
});
