import { describe, expect, it } from "vitest";
import type { SalesDashboardResponse } from "@contracts/DashboardContracts";
import { pointsTrend, relativeTrend, summaryCards } from "../../src/features/dashboard/sales/summary/summaryCards";

// ---------------------------------------------------------------------------
// El resumen del Dashboard: qué dice cada tarjeta, su cambio frente al
// periodo anterior (en % o, para la conversión, en puntos), el gasto en gris
// y lo que no se muestra a quien no puede ver los anuncios.
// ---------------------------------------------------------------------------

const trend = (value: number, previous: number) => ({ value, previous, change: previous ? (value - previous) / previous : null });

const view = (over: Partial<SalesDashboardResponse> = {}): SalesDashboardResponse => ({
  currency: "COP", missingRates: [], revenue: trend(600000, 300000), sales: trend(12, 6), averageTicket: 50000,
  leads: trend(60, 50), leadsFromAds: 40, conversion: 0.15, conversionPrevious: 0.1, convertedLeads: 9, reviewCount: 0,
  ads: { spend: trend(100000, 80000), revenue: trend(500000, 200000), profit: trend(400000, 120000), realProfit: null, roas: 5, roasMeta: 1.5, costPerSale: 10000, costPerChat: 2500, revenuePerChat: 12500, chats: 40, attributedSales: 10, impressions: 20000, clicks: 600, measurement: { state: "measured", metaChats: 40, arrivedChats: 38, metaPurchases: 3 }, activeCampaigns: 1 },
  realProfit: null, profit: trend(500000, 220000), otherSpend: null, otherExpenses: [], costsKnown: false,
  daily: [], funnel: null, byHour: [], byConnection: [], byProduct: [], byCountry: [], recentSales: [], canSeeAds: true,
  ...over
});

const byId = (cards: ReturnType<typeof summaryCards>, id: string) => cards.find((card) => card.id === id)!;

describe("summaryCards", () => {
  it("las ocho tarjetas, en orden, con su cambio frente al periodo anterior", () => {
    const cards = summaryCards(view());
    expect(cards.map((card) => card.label)).toEqual(["Facturación", "Ventas", "Compra promedio", "Ganancia", "Leads nuevos", "Conversión", "ROAS real", "Inversión en Meta"]);
    // Compra promedio: 50.000 frente a 300.000 ÷ 6 = 50.000 → igual.
    expect(byId(cards, "ticket").trend).toEqual({ text: "= igual", tone: "flat" });
    // ROAS: 5x frente a 200.000 ÷ 80.000 = 2,5x → ▲ 100 %.
    expect(byId(cards, "roas")).toMatchObject({ value: "5x", note: "Meta: 1,5x", trend: { text: "▲ 100 %", tone: "good" } });
    expect(byId(cards, "conversion")).toMatchObject({ value: "15 %", note: "9 de 60 leads compraron", trend: { text: "▲ 5 pts", tone: "good" } });
    expect(byId(cards, "spend")).toMatchObject({ note: "1 campaña activa", trend: { text: "▲ 25 %", tone: "flat" } });
    expect(byId(cards, "profit").note).toBe("Facturación − inversión en Meta");
  });

  it("sin permiso para ver el gasto: ni ROAS, ni inversión, ni ganancia (la delataría)", () => {
    const cards = summaryCards(view({ canSeeAds: false, ads: null, profit: null }));
    expect(cards.map((card) => card.id)).toEqual(["revenue", "sales", "ticket", "leads", "conversion"]);
  });

  it("sin Meta conectado, ROAS e inversión invitan a conectarlo; sin leads, la conversión lo dice", () => {
    const cards = summaryCards(view({ ads: null, conversion: null, conversionPrevious: null, convertedLeads: 0, leads: trend(0, 0) }));
    expect(byId(cards, "roas")).toMatchObject({ value: "—", note: "Conecta Meta Ads para verlo", trend: null });
    expect(byId(cards, "conversion")).toMatchObject({ value: "—", note: "Aún no hay leads nuevos", trend: null });
  });

  it("una línea sin campañas no invita a conectar Meta: dice que la línea no tiene campañas", () => {
    const cards = summaryCards(view({ ads: null, lineWithoutCampaigns: true }));
    expect(byId(cards, "roas")).toMatchObject({ value: "—", note: "Esta línea no tiene campañas" });
    expect(byId(cards, "spend")).toMatchObject({ value: "—", note: "Esta línea no tiene campañas" });
  });
});

describe("la inversión con otros gastos", () => {
  const withOther = (over: Partial<SalesDashboardResponse> = {}) => view({
    otherSpend: trend(1_030_000, 1_000_000),
    otherExpenses: [{ id: "a", name: "Pasarela", amount: 30_000 }, { id: "b", name: "Nómina", amount: 1_000_000 }],
    ...over
  });

  it("sin otros gastos queda como siempre, con el enlace para crearlos", () => {
    expect(byId(summaryCards(view()), "spend")).toMatchObject({ label: "Inversión en Meta", value: "$ 100.000 COP", action: { label: "Otros gastos" } });
    expect(byId(summaryCards(view()), "spend").modes).toBeUndefined();
  });

  it("Todo suma Meta y los otros; Meta y Otros los muestran por separado", () => {
    expect(byId(summaryCards(withOther()), "spend")).toMatchObject({
      label: "Inversión", value: "$ 1.130.000 COP", note: "Meta $ 100.000 COP · otros $ 1.030.000 COP", modes: { current: "all" }, trend: { text: "▲ 5 %", tone: "flat" }
    });
    expect(byId(summaryCards(withOther(), "meta"), "spend")).toMatchObject({ value: "$ 100.000 COP", note: "1 campaña activa" });
    expect(byId(summaryCards(withOther(), "other"), "spend")).toMatchObject({ value: "$ 1.030.000 COP", note: "2 gastos: Pasarela, Nómina" });
  });

  it("la ganancia dice qué se restó", () => {
    expect(byId(summaryCards(withOther()), "profit").note).toBe("Facturación − Meta − otros gastos");
    expect(byId(summaryCards(withOther({ ads: null, costsKnown: true })), "profit").note).toBe("Facturación − otros gastos − costo de productos");
  });
});

describe("cambios", () => {
  it("relativo: sin periodo anterior no hay cambio; una ganancia negativa se compara en valor absoluto", () => {
    expect(relativeTrend(10, 0)).toBeNull();
    expect(relativeTrend(50, -100)).toEqual({ text: "▲ 150 %", tone: "good" });
    expect(relativeTrend(80, 100)).toEqual({ text: "▼ 20 %", tone: "bad" });
  });

  it("una tasa cambia en puntos, no en porcentaje", () => {
    expect(pointsTrend(0.1, 0.15)).toEqual({ text: "▼ 5 pts", tone: "bad" });
    expect(pointsTrend(0.2, null)).toBeNull();
  });
});
