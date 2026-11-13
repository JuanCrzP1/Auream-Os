import { describe, expect, it } from "vitest";
import { AdsDashboardService } from "../../domains/analytics/application/AdsDashboardService.js";
import type { FxRates } from "../../domains/analytics/application/CurrencyConverter.js";
import type { AdsReader, SalesReader } from "../../domains/analytics/application/DashboardReaders.js";
import { SalesDashboardService } from "../../domains/analytics/application/SalesDashboardService.js";
import { adviceFor } from "../../domains/analytics/domain/adAdvice.js";
import { measurementStateOf, salesProofSince } from "../../domains/analytics/domain/adMeasurement.js";

// ---------------------------------------------------------------------------
// «Sin datos» nunca sale como «no vendió»: si Auream no ve los chats de un
// anuncio (llegan a otra herramienta) o el negocio no anota sus ventas, no hay
// veredicto, ni ROAS real ni ganancia; solo lo que reporta Meta. El caso que
// lo destapó: una cuenta recién conectada con todo su WhatsApp en otro lado
// salía con «Apagar» en campañas que según Meta vendían 299 veces.
// ---------------------------------------------------------------------------

const seen = { metaChats: 100, arrivedChats: 90, sales: 4, metaPurchases: 2, recordsSales: true };

describe("cuánto ve Auream de un anuncio", () => {
  it("sin medir: Meta cobra chats y a Auream no llega ninguno (con pocos chats aún no se sabe)", () => {
    expect(measurementStateOf({ ...seen, arrivedChats: 0, sales: 0 })).toBe("none");
    expect(measurementStateOf({ ...seen, metaChats: 4, arrivedChats: 0, sales: 0 })).toBe("measured");
  });

  it("medición parcial: llegó menos de la mitad (un número recién conectado); con pocos chats la proporción no cuenta", () => {
    expect(measurementStateOf({ ...seen, arrivedChats: 49 })).toBe("partial");
    expect(measurementStateOf({ ...seen, arrivedChats: 50 })).toBe("measured");
    // Los chats llegaron antes del periodo y la venta cae ahora: algo se ve, pero no todo.
    expect(measurementStateOf({ ...seen, arrivedChats: 0, sales: 2 })).toBe("partial");
    expect(measurementStateOf({ ...seen, metaChats: 9, arrivedChats: 2 })).toBe("measured");
  });

  it("sin ventas: los chats llegan pero el negocio no las anota, o Meta cuenta ventas que Auream no ve", () => {
    expect(measurementStateOf({ ...seen, sales: 0, recordsSales: false })).toBe("unsold");
    expect(measurementStateOf({ ...seen, sales: 0, metaPurchases: 3 })).toBe("unsold");
    // El negocio anota ventas y Meta tampoco vio ninguna: de verdad no vendió.
    expect(measurementStateOf({ ...seen, sales: 0 })).toBe("measured");
  });

  it("la prueba de que el negocio anota ventas se busca en el periodo o en los últimos 30 días, lo que abarque más", () => {
    const until = new Date("2026-11-14T05:00:00.000Z");
    expect(salesProofSince({ from: new Date("2026-11-07T05:00:00.000Z"), until }).toISOString()).toBe("2026-10-15T05:00:00.000Z");
    expect(salesProofSince({ from: new Date("2026-08-16T05:00:00.000Z"), until }).toISOString()).toBe("2026-08-16T05:00:00.000Z");
  });
});

describe("el consejo, según lo que se ve", () => {
  const base = { spend: 1_750_508, sales: 0, chats: 1779, roas: null, accountCostPerSale: null };
  const state = (value: "none" | "partial" | "unsold", extra = {}) => ({ state: value, metaChats: 1779, arrivedChats: 0, metaPurchases: 299, ...extra });

  it("nunca «Apagar» ni «Revisar» por falta de datos: dice qué falta", () => {
    expect(adviceFor({ ...base, measurement: state("none") })).toEqual({ advice: "unmeasured", reason: "Sus 1.779 chats no llegan a Auream: no hay con qué juzgarla." });
    expect(adviceFor({ ...base, measurement: state("partial", { arrivedChats: 120 }) })).toEqual({ advice: "partial", reason: "A Auream llegaron 120 de 1.779 chats: aún no se puede juzgar." });
    expect(adviceFor({ ...base, measurement: state("unsold", { arrivedChats: 1700 }) })).toEqual({ advice: "unsold", reason: "Meta cuenta 299 ventas y Auream ninguna: revisa que se estén anotando." });
    expect(adviceFor({ ...base, measurement: state("unsold", { arrivedChats: 1700, metaPurchases: 0 }) }).reason).toBe("Auream no ve ventas tuyas: anótalas para poder juzgarla.");
  });

  it("midiendo todo, 1.779 chats sin una venta sí es para apagar; y lo que gastó poco sigue aprendiendo", () => {
    const measured = { state: "measured" as const, metaChats: 1779, arrivedChats: 1700, metaPurchases: 0 };
    expect(adviceFor({ ...base, roas: 0, measurement: measured }).advice).toBe("pause");
    expect(adviceFor({ ...base, spend: 0, chats: 0, measurement: { state: "unsold", metaChats: 0, arrivedChats: 0, metaPurchases: 0 } }).advice).toBe("learning");
  });
});

const NOW = new Date("2026-11-13T22:00:00.000Z");
const fx: FxRates = { table: async () => new Map([["2026-11-01", new Map([["COP", 4000]])]]), refresh: async () => {} };
const tz = async () => "America/Bogota";
const day = (id: string, spend: number, conversations: number, metaPurchases: number, metaRevenue: number) =>
  ({ id, day: "2026-11-10", currency: "COP", spend, impressions: 1000, clicks: 100, conversations, metaPurchases, metaRevenue });

/** Una cuenta recién conectada: Meta reporta gasto, chats y ventas; el WhatsApp de esos anuncios está en otra herramienta. */
const elsewhere = (overrides: Partial<AdsReader> = {}): AdsReader => ({
  status: async () => ({ accounts: 1, lastSyncedAt: null, mainCurrency: "COP", activeCampaigns: 2 }),
  spend: async () => [day("x", 2_931_653, 2918, 503, 600_000)],
  entityDays: async () => [day("c1", 1_750_508, 1779, 299, 350_000), day("c2", 1_181_145, 1139, 204, 250_000), day("c3", 0, 0, 1, 0)],
  entities: async () => [],
  attributed: async () => [],
  arrivals: async () => [],
  recordsSales: async () => false,
  ...overrides
});
const noSales: SalesReader = {
  days: async () => [], byHour: async () => [], breakdown: async () => [], reviewCount: async () => 0, recent: async () => [],
  leads: async () => ({ total: 0, fromAds: 0, converted: 0 })
};
const performance = (reader: AdsReader) => new AdsDashboardService(reader, fx, tz, () => NOW).performance("t", {}, "campaign");

describe("Anuncios, cuando Auream no ve las ventas", () => {
  it("los chats están en otra herramienta: sin veredicto, sin ROAS ni ganancia; lo de Meta sí se ve", async () => {
    const view = await performance(elsewhere());
    expect(view.measurement).toEqual({ state: "none", metaChats: 2918, arrivedChats: 0, metaPurchases: 504 });
    expect(view.rows.map((row) => [row.id, row.advice, row.roas, row.profit])).toEqual([["c1", "unmeasured", null, null], ["c2", "unmeasured", null, null], ["c3", "learning", null, null]]);
    expect(view.totals).toMatchObject({ spend: 2_931_653, chats: 2918, metaPurchases: 504, roas: null, profit: null, roasMeta: 0.2, costPerChat: 1004.68, costPerSale: null });
  });

  it("número recién conectado: llegó una parte de los chats y aún no se juzga, aunque ya haya ventas", async () => {
    const view = await performance(elsewhere({
      arrivals: async () => [{ id: "c1", chats: 120 }, { id: "c2", chats: 900 }, { id: "viejo", chats: 40 }],
      attributed: async () => [{ id: "c1", day: "2026-11-12", currency: "COP", amount: 300_000, count: 2, late: 0 }],
      recordsSales: async () => true
    }));
    const [c1, c2] = view.rows;
    expect(c1).toMatchObject({ advice: "partial", arrivedChats: 120, sales: 2, roas: 0.17, adviceReason: "A Auream llegaron 120 de 1.779 chats: aún no se puede juzgar." });
    // A esta sí le llegan sus chats; Meta le cuenta 204 ventas y Auream ninguna: no se apaga, se revisa lo que se anota.
    expect(c2).toMatchObject({ advice: "unsold", arrivedChats: 900, roas: null, profit: null });
    // En el total cuentan todos los que llegaron por anuncio (también por campañas sin gasto en el periodo): 1.060 de 2.918.
    expect(view.measurement).toMatchObject({ state: "partial", arrivedChats: 1060 });
    expect(view.totals).toMatchObject({ roas: 0.1, profit: -2_631_653 });
  });

  it("medición parcial y ninguna venta todavía: tampoco sale «0x» ni una pérdida", async () => {
    const view = await performance(elsewhere({ arrivals: async () => [{ id: "c1", chats: 120 }], recordsSales: async () => true }));
    expect(view.rows[0]).toMatchObject({ id: "c1", advice: "partial", sales: 0, roas: null, profit: null });
    expect(view.measurement.state).toBe("partial");
    expect(view.totals).toMatchObject({ roas: null, profit: null });
  });

  it("los chats llegan pero el negocio no anota ventas: ninguna campaña se apaga por eso", async () => {
    const view = await performance(elsewhere({ arrivals: async () => [{ id: "c1", chats: 1700 }, { id: "c2", chats: 1100 }] }));
    expect(view.measurement.state).toBe("unsold");
    expect(view.rows.slice(0, 2).map((row) => row.advice)).toEqual(["unsold", "unsold"]);
    expect(view.totals).toMatchObject({ roas: null, profit: null });
  });

  it("Dashboard › Ventas dice lo mismo: sin ROAS real ni «cada chat deja», con el mismo estado", async () => {
    const view = await new SalesDashboardService(noSales, elsewhere(), fx, tz, () => NOW).overview({ tenantId: "t", canSeeAds: true }, {});
    expect(view.ads).toMatchObject({ roas: null, revenuePerChat: null, roasMeta: 0.2, chats: 2918, costPerChat: 1004.68, measurement: { state: "none", metaChats: 2918, arrivedChats: 0, metaPurchases: 503 } });
  });
});
