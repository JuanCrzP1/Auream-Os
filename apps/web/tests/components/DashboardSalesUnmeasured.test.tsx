import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdMeasurement } from "@contracts/AdMeasurementContracts";
import type { SalesDashboardResponse } from "@contracts/DashboardContracts";
import type { LineComparisonRow } from "@contracts/LineComparisonContracts";
import { AdFunnel } from "../../src/features/dashboard/sales/AdFunnel";
import { MONEY_COLUMNS, verdict } from "../../src/features/dashboard/sales/lines/lineCells";
import { RevenueChart } from "../../src/features/dashboard/sales/RevenueChart";
import { summaryCards } from "../../src/features/dashboard/sales/summary/summaryCards";

// ---------------------------------------------------------------------------
// Dashboard › Ventas con la regla «lo de Auream / lo de Meta»: el número
// grande es de Auream; si Auream aún no tiene ventas, va lo que reporta Meta
// con la etiqueta «Meta»; la ganancia y la conversión esperan a las ventas
// reales (nunca «$0», «0 %» ni una pérdida). Cuando Auream vende, pasa sola
// a sus números con Meta al lado.
// ---------------------------------------------------------------------------

const trend = (value: number, previous: number) => ({ value, previous, change: previous ? (value - previous) / previous : null });
const NONE: AdMeasurement = { state: "none", metaChats: 1843, arrivedChats: 0, metaPurchases: 323 };

const view = (over: Partial<SalesDashboardResponse> = {}): SalesDashboardResponse => ({
  currency: "COP", missingRates: [], revenue: trend(0, 0), sales: trend(0, 0), averageTicket: null, leads: trend(3, 2), leadsFromAds: 0, conversion: 0, conversionPrevious: 0, convertedLeads: 0, reviewCount: 0,
  ads: { spend: trend(4_720_736, 4_760_000), revenue: trend(0, 0), profit: trend(-4_720_736, -4_760_000), realProfit: null, roas: null, roasMeta: 0.3, costPerSale: null, costPerSaleMeta: 14_615, metaRevenue: 1_416_000, metaPurchases: 323, costPerChat: 2561, revenuePerChat: null, chats: 1843, attributedSales: 0, impressions: 90_000, clicks: 2100, activeCampaigns: 5, measurement: NONE },
  realProfit: null, profit: trend(-4_720_736, -4_760_000), otherSpend: null, otherExpenses: [], costsKnown: false,
  daily: [{ day: "2026-11-12", revenue: 0, spend: 150_000 }, { day: "2026-11-13", revenue: 0, spend: 160_000 }],
  funnel: { impressions: 90_000, clicks: 2100, chats: 1843, sales: 0 }, byHour: [], byConnection: [], byProduct: [], byCountry: [], recentSales: [], canSeeAds: true, canExport: false,
  ...over
});
const card = (v: SalesDashboardResponse, id: string) => summaryCards(v).find((c) => c.id === id)!;

describe("el resumen", () => {
  it("sin ventas en Auream: lo de Meta con su etiqueta; ganancia y conversión esperan", () => {
    const v = view();
    expect(card(v, "revenue")).toMatchObject({ value: "$ 1.416.000 COP", note: "Lo que reporta Meta", source: "meta", trend: null });
    expect(card(v, "sales")).toMatchObject({ value: "323", note: "Compras que vio Meta", source: "meta", trend: null });
    expect(card(v, "ticket")).toMatchObject({ value: "$ 4.384 COP", note: "Lo que reporta Meta", source: "meta" });
    expect(card(v, "profit")).toMatchObject({ value: "—", note: "Se calcula cuando tus anuncios vendan en Auream", trend: null });
    expect(card(v, "profit").source).toBeUndefined();
    expect(card(v, "conversion")).toMatchObject({ value: "—", note: "Se calcula cuando vendas en Auream", trend: null });
    expect(card(v, "roas")).toMatchObject({ label: "ROAS", value: "0,3x", note: "Lo que reporta Meta", source: "meta" });
    expect(card(v, "spend").value).toBe("$ 4.720.736 COP");
  });

  it("con ventas orgánicas en Auream: lo vendido es de Auream (sin etiqueta) y la ganancia sigue esperando", () => {
    const v = view({ revenue: trend(300_000, 0), sales: trend(3, 0), averageTicket: 100_000, conversion: 0.5, convertedLeads: 1 });
    expect(card(v, "revenue")).toMatchObject({ value: "$ 300.000 COP", note: "Lo vendido y anotado en Auream" });
    expect(card(v, "revenue").source).toBeUndefined();
    expect(card(v, "sales").value).toBe("3");
    expect(card(v, "profit")).toMatchObject({ value: "—", trend: null });
  });

  it("cuando los anuncios venden en Auream, pasa sola a sus números con Meta al lado", () => {
    const base = view({ revenue: trend(600_000, 0), sales: trend(6, 0) });
    const v = { ...base, ads: { ...base.ads!, attributedSales: 6, roas: 0.13, measurement: { ...NONE, state: "measured" as const, arrivedChats: 1800 } }, profit: trend(-4_120_736, 0) };
    expect(card(v, "profit").value).toBe("$ -4.120.736 COP");
    expect(card(v, "revenue")).toMatchObject({ value: "$ 600.000 COP" });
    expect(card(v, "roas")).toMatchObject({ label: "ROAS real", value: "0,1x", note: "Meta: 0,3x" });
    expect(card(v, "roas").source).toBeUndefined();
  });
});

describe("la gráfica y el embudo", () => {
  it("sin ventas en Auream, la curva es lo que reporta Meta (en su azul) y no hay ganancia", () => {
    const points = view().daily.map((d) => ({ ...d, metaRevenue: 200_000 }));
    const { container } = render(<RevenueChart points={points} currency="COP" withSpend withProfit={false} revenueFrom="meta" />);
    expect(container.querySelector(".revenue-chart__profit")).toBeNull();
    expect(container.querySelector(".revenue-chart__line--meta")).not.toBeNull();
    expect(container.querySelector(".revenue-chart__spend")).not.toBeNull();
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/^Lo que Meta reporta en compras y gasto por día; el mejor día Meta reportó/);
  });

  it("«Compraron» no es 0: las compras que vio Meta, con su etiqueta", () => {
    render(<AdFunnel view={view()} />);
    const bought = screen.getByText("Compraron").closest("li")!;
    expect(bought).toHaveTextContent("Compraron323 Metacosto por compra $ 14.615 COP");
    expect(screen.getByText("1.843")).toBeInTheDocument();
  });
});

describe("Comparar líneas", () => {
  const row = (name: string, extra: Partial<LineComparisonRow>): LineComparisonRow => ({
    id: name, name, color: null, revenue: trend(0, 0), sales: 0, averageTicket: null, share: null, hasCampaigns: true,
    spend: 2_000_000, roas: null, roasMeta: 0.4, metaPurchases: 300, metaRevenue: 800_000, otherSpend: 0, profit: null, margin: null, salesUnknown: true, ...extra
  });

  it("una línea que gasta sin ventas en Auream: ROAS de Meta con su etiqueta; ganancia y margen esperan (no «pierde plata»)", () => {
    const venezuela = row("Venezuela", {});
    const cell = (id: string) => MONEY_COLUMNS.find((c) => c.id === id)!.cell(venezuela, "COP");
    expect(cell("roas")).toMatchObject({ text: "0,4x", source: "meta" });
    expect(cell("profit")).toMatchObject({ text: "—", tone: "muted", hint: "Se calcula cuando tus anuncios vendan en Auream" });
    expect(cell("margin").text).toBe("—");
    expect(verdict([venezuela, row("Colombia", {})], true, "COP")).toBe("Cuánto deja cada línea se calcula cuando sus anuncios vendan en Auream.");
    const colombia = row("Colombia", { salesUnknown: undefined, profit: trend(200_000, 0), revenue: trend(500_000, 0) });
    expect(verdict([colombia, venezuela], true, "COP")).toBe("Colombia es la que más te deja: $ 200.000 COP.");
  });
});
