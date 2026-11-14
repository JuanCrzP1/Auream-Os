import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdMeasurement } from "@contracts/AdMeasurementContracts";
import type { AdsDashboardResponse, SalesDashboardResponse } from "@contracts/DashboardContracts";
import type { LineComparisonRow } from "@contracts/LineComparisonContracts";
import { AdFunnel } from "../../src/features/dashboard/sales/AdFunnel";
import { AdsHero } from "../../src/features/dashboard/sales/AdsHero";
import { CampaignAdvice } from "../../src/features/dashboard/sales/CampaignAdvice";
import { MONEY_COLUMNS } from "../../src/features/dashboard/sales/lines/lineCells";
import { summaryCards } from "../../src/features/dashboard/sales/summary/summaryCards";

// ---------------------------------------------------------------------------
// La revisión de la regla «lo de Auream / lo de Meta» cuando Auream YA vende:
// cada número de Auream que Meta también reporta lleva lo de Meta al lado
// («Meta: …»), en todas las piezas del Dashboard. Si una pieza nueva o
// cambiada lo olvida, esta prueba falla. (El caso sin ventas en Auream está
// en `DashboardSalesUnmeasured` y `AdsMeasurement`.)
// ---------------------------------------------------------------------------

const trend = (value: number, previous: number) => ({ value, previous, change: previous ? (value - previous) / previous : null });
const MEASURED: AdMeasurement = { state: "measured", metaChats: 640, arrivedChats: 600, metaPurchases: 21 };

const view: SalesDashboardResponse = {
  currency: "COP", missingRates: [], revenue: trend(2_100_000, 0), sales: trend(35, 0), averageTicket: 60_000, leads: trend(600, 0), leadsFromAds: 580, conversion: 0.05, conversionPrevious: null, convertedLeads: 30, reviewCount: 0,
  ads: { spend: trend(700_000, 0), revenue: trend(1_900_000, 0), profit: trend(1_200_000, 0), realProfit: null, roas: 2.71, roasMeta: 0.6, costPerSale: 21_212, costPerSaleMeta: 33_333, metaRevenue: 420_000, metaPurchases: 21, costPerChat: 1094, revenuePerChat: 2969, chats: 640, attributedSales: 33, impressions: 90_000, clicks: 2100, activeCampaigns: 2, measurement: MEASURED },
  realProfit: null, profit: trend(1_400_000, 0), otherSpend: null, otherExpenses: [], costsKnown: false,
  daily: [], funnel: { impressions: 90_000, clicks: 2100, chats: 640, sales: 33 }, byHour: [], byConnection: [], byProduct: [], byCountry: [], recentSales: [], canSeeAds: true, canExport: false
};

describe("con ventas en Auream, lo de Meta va al lado en todo el Dashboard", () => {
  it("resumen: facturación, ventas, compra promedio y ROAS real", () => {
    const card = (id: string) => summaryCards(view).find((c) => c.id === id)!;
    expect(card("revenue")).toMatchObject({ value: "$ 2.100.000 COP", beside: "Meta: $ 420.000 COP" });
    expect(card("sales")).toMatchObject({ value: "35", note: "Aprobadas en Auream", beside: "Meta: 21 compras" });
    expect(card("ticket")).toMatchObject({ value: "$ 60.000 COP", beside: "Meta: $ 20.000 COP" });
    expect(card("roas")).toMatchObject({ label: "ROAS real", value: "2,7x", note: "Meta: 0,6x" });
    // Ningún número de Auream lleva la etiqueta «Meta».
    expect(summaryCards(view).filter((c) => c.source === "meta")).toEqual([]);
  });

  it("franja: facturación, costo por venta, cada chat y el ROAS real", () => {
    render(<AdsHero view={view} periodWords="últimos 30 días" />);
    const hero = screen.getByRole("region", { name: "La plata de tus anuncios" });
    expect(hero).toHaveTextContent("Facturación por anuncios$ 1.900.000 COP33 ventas · Meta: $ 420.000 COP");
    expect(hero).toHaveTextContent("Costo por venta$ 21.212 COP33 ventas por anuncio · Meta: $ 33.333 COP");
    expect(hero).toHaveTextContent("Cada chat de anuncio deja$ 2.969 COPen ventas, en promedio · Meta: $ 656 COP");
    expect(hero).toHaveTextContent("Meta: 0,6x: no ve las compras que pasan en WhatsApp");
  });

  it("embudo: los chats dicen cuántos llegaron a Auream y las compras, lo de Meta", () => {
    render(<AdFunnel view={view} />);
    expect(screen.getByText("Escribieron").closest("li")).toHaveTextContent("costo por chat $ 1.094 COP · llegaron 600 a Auream");
    expect(screen.getByText("Compraron").closest("li")).toHaveTextContent("Compraron33costo por venta $ 21.212 COP · Meta: 21 compras");
  });

  it("qué hacer con tus campañas: ROAS real y costo por venta con lo de Meta", () => {
    const row = { id: "c1", name: "Dilo cantando", level: "campaign" as const, status: "ACTIVE", parentName: null, dailyBudget: null, thumbnailUrl: null, spend: 700_000, impressions: 90_000, clicks: 2100, chats: 640, arrivedChats: 600, sales: 33, metaPurchases: 21, revenue: 1_900_000, metaRevenue: 420_000, profit: 1_200_000, roas: 2.71, roasMeta: 0.6, costPerChat: 1094, costPerSale: 21_212, costPerSaleMeta: 33_333, ctr: 0.02, advice: "keep" as const, adviceReason: "Rinde bien." };
    const data: AdsDashboardResponse = { currency: "COP", level: "campaign", rows: [row], totals: row, measurement: MEASURED, unseenSales: 12, lateShare: null, lastSyncedAt: null, connected: true };
    render(<CampaignAdvice data={data} onSeeAll={() => {}} />);
    const item = screen.getByText("Dilo cantando").closest("li")!;
    expect(item).toHaveTextContent("ROAS real · Meta: 0,6x");
    expect(item).toHaveTextContent("costo por venta · Meta: $ 33.333 COP");
  });

  it("comparar líneas: facturación, ventas y ROAS real de cada línea con lo de Meta", () => {
    const line: LineComparisonRow = {
      id: "v", name: "Venezuela", color: null, revenue: trend(2_100_000, 0), sales: 35, averageTicket: 60_000, share: 1, hasCampaigns: true,
      spend: 700_000, roas: 2.71, roasMeta: 0.6, metaPurchases: 21, metaRevenue: 420_000, otherSpend: 0, profit: trend(1_400_000, 0), margin: 0.67
    };
    const cell = (id: string) => MONEY_COLUMNS.find((c) => c.id === id)!.cell(line, "COP");
    expect(cell("revenue").beside).toBe("Meta: $ 420.000 COP");
    expect(cell("sales").beside).toBe("Meta: 21 compras");
    expect(cell("roas")).toMatchObject({ text: "2,7x", beside: "Meta: 0,6x" });
  });
});
