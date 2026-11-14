import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AdsDashboardResponse, SalesDashboardResponse } from "@contracts/DashboardContracts";
import type { AttentionDashboardResponse } from "@contracts/AttentionContracts";
import { DashboardPage } from "../../src/features/dashboard/pages/DashboardPage";
import { trendText } from "../../src/features/dashboard/dashboardFormat";
import { presetRange } from "../../src/features/dashboard/period/periodModel";

// ---------------------------------------------------------------------------
// Dashboard: primero la plata de los anuncios (ROAS real frente a Meta,
// ganancia), luego ventas, del anuncio a la venta, qué hacer con cada campaña
// y la atención por asesor. Quien no ve el gasto no ve nada de anuncios.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const trend = (value: number, previous: number) => ({ value, previous, change: previous ? (value - previous) / previous : null });
const metrics = { spend: 100000, impressions: 20000, clicks: 600, chats: 40, arrivedChats: 38, sales: 10, metaPurchases: 3, revenue: 500000, metaRevenue: 150000, profit: 400000, roas: 5, roasMeta: 1.5, costPerChat: 2500, costPerSale: 10000, ctr: 0.03 };

const SALES = (withAds: boolean): SalesDashboardResponse => ({
  currency: "COP", missingRates: [], revenue: trend(600000, 300000), sales: trend(12, 6), averageTicket: 50000, leads: trend(60, 50), leadsFromAds: 40, conversion: 0.15, conversionPrevious: 0.1, convertedLeads: 9, reviewCount: 2,
  ads: withAds ? { spend: trend(100000, 80000), revenue: trend(500000, 200000), profit: trend(400000, 120000), realProfit: 360000, roas: 5, roasMeta: 1.5, costPerSale: 10000, costPerChat: 2500, revenuePerChat: 12500, chats: 40, attributedSales: 10, impressions: 20000, clicks: 600, measurement: { state: "measured", metaChats: 40, arrivedChats: 38, metaPurchases: 3 }, activeCampaigns: 3 } : null,
  realProfit: 360000, profit: withAds ? trend(360000, 160000) : null, otherSpend: null, otherExpenses: [], costsKnown: true,
  daily: [{ day: "2026-11-01", revenue: 100000, spend: 20000 }, { day: "2026-11-02", revenue: 500000, spend: 80000 }],
  funnel: withAds ? { impressions: 20000, clicks: 600, chats: 40, sales: 10 } : null,
  byHour: Array.from({ length: 24 }, (_, h) => (h === 20 ? 5 : 1)),
  byConnection: [{ key: "c1", label: "Ventas 1", revenue: 600000, sales: 12 }], byProduct: [{ key: "p1", label: "Video", revenue: 600000, sales: 12 }], byCountry: [{ key: "CO", label: "CO", revenue: 600000, sales: 12 }],
  recentSales: [{ id: "s1", customerName: "Laura", productName: "Video", amount: 49900, currency: "COP", adName: "Tu canción", connectionName: "Ventas 1", soldAt: new Date().toISOString() }],
  canSeeAds: withAds
});
const ADS: AdsDashboardResponse = {
  currency: "COP", level: "campaign", connected: true, measurement: { state: "measured", metaChats: 40, arrivedChats: 38, metaPurchases: 3 }, unseenSales: 7, lateShare: 0.2, lastSyncedAt: null, totals: metrics,
  rows: [{ ...metrics, id: "c1", name: "Video Colombia", level: "campaign", status: "ACTIVE", parentName: null, dailyBudget: null, thumbnailUrl: null, advice: "scale", adviceReason: "Deja 5 por cada 1 que gastas." }]
};
const ATTENTION: AttentionDashboardResponse = {
  currency: "COP", leads: trend(60, 50), attendedByAgents: trend(30, 20), botOnly: 20, unanswered: 5, oldestWaitingAt: new Date(Date.now() - 80 * 60_000).toISOString(),
  firstResponseMinutes: 4, previousFirstResponseMinutes: 6, heatmap: Array.from({ length: 7 }, (_, d) => Array.from({ length: 12 }, (_, b) => (d === 1 && b === 10 ? 12 : 1))),
  peak: { weekday: 1, hour: 20, chats: 12 }, agents: [{ userId: "u1", name: "Sofía Rojas", attended: 30, messages: 120, responseMinutes: 3, sales: 8, revenue: 400000 }],
  connections: [{ id: "c1", name: "Ventas 1", connected: true, leads: 60, attended: 30, unanswered: 5 }]
};

let paths: string[] = [];
function stub(owner: boolean) {
  paths = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(String(input), "http://api.test");
    paths.push(url.pathname + url.search);
    if (url.pathname === "/ads/accounts") return owner ? reply(200, { connection: { connected: true }, accounts: [], canManage: true, oauthAvailable: false }) : reply(403, {});
    if (url.pathname === "/dashboard/sales") return reply(200, SALES(owner));
    if (url.pathname === "/dashboard/ads") return reply(200, ADS);
    if (url.pathname === "/dashboard/attention") return reply(200, ATTENTION);
    if (url.pathname === "/connections") return reply(200, { connections: [] });
    if (url.pathname === "/products") return reply(200, { products: [], canManage: false });
    return reply(404, {});
  }));
}

const page = (path = "/dashboard") => render(<MemoryRouter initialEntries={[path]}><DashboardPage /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Dashboard", () => {
  it("Ventas: el ROAS real frente a Meta, la ganancia, del anuncio a la venta y qué hacer con cada campaña", async () => {
    stub(true);
    page();
    const hero = await screen.findByRole("region", { name: "La plata de tus anuncios" });
    expect(within(hero).getByText("5x")).toBeInTheDocument();
    expect(within(hero).getByText(/te vuelven/)).toHaveTextContent("$ 5,00");
    expect(within(hero).getByText(/Meta: 1,5x/)).toBeInTheDocument();
    expect(within(hero).getByText("Ganancia real")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Del anuncio a la venta" })).toHaveTextContent("costo por venta $ 10.000");
    expect(await screen.findByRole("region", { name: "Qué hacer con tus campañas" })).toHaveTextContent("Escalar");
    expect(screen.getByText("Tu canción")).toBeInTheDocument();
    expect(screen.getByText("2 ventas por revisar →")).toBeInTheDocument();

    const summary = screen.getByRole("region", { name: "Resumen del periodo" });
    const card = (name: string) => within(summary).getByRole("article", { name });
    expect(within(summary).getAllByRole("article").map((item) => item.getAttribute("aria-label"))).toEqual([
      "Facturación", "Ventas", "Compra promedio", "Ganancia", "Leads nuevos", "Conversión", "ROAS real", "Inversión en Meta"
    ]);
    expect(card("Ventas")).toHaveTextContent("Ventas▲ 100 %12Aprobadas · 2 por revisar");
    expect(card("Conversión")).toHaveTextContent("15 %");
    expect(card("Conversión")).toHaveTextContent("9 de 60 leads compraron");
    expect(card("Conversión")).toHaveTextContent("▲ 5 pts");
    expect(card("Inversión en Meta")).toHaveTextContent("3 campañas activas");
  });

  it("el periodo y el número viajan a la API; Anuncios muestra la tabla con la venta real", async () => {
    stub(true);
    page("/dashboard?period=7d");
    await screen.findByRole("region", { name: "La plata de tus anuncios" });
    const { from, to } = presetRange("7d");
    expect(paths).toContain(`/dashboard/sales?from=${from}&to=${to}`);
    await userEvent.click(screen.getByRole("tab", { name: "Anuncios" }));
    expect(await screen.findByRole("table")).toHaveTextContent("Video Colombia");
    expect(screen.getByText(/ventas que Meta no vio/)).toBeInTheDocument();
  });

  it("Fechas: un atajo se aplica al tocarlo y unas fechas a mano viajan a la API con su comparación", async () => {
    stub(true);
    page();
    await screen.findByRole("region", { name: "La plata de tus anuncios" });

    await userEvent.click(screen.getByRole("button", { name: "Elegir fechas" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Elegir fechas" })).getByRole("button", { name: "Mes pasado" }));
    const last = presetRange("lastMonth");
    await waitFor(() => expect(paths).toContain(`/dashboard/sales?from=${last.from}&to=${last.to}`));
    expect(screen.queryByRole("dialog", { name: "Elegir fechas" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechas: Mes pasado" })).toHaveAttribute("aria-pressed", "true");

    // A mano: del 3 al 18 del mes pasado (se ve a la izquierda).
    await userEvent.click(screen.getByRole("button", { name: "Fechas: Mes pasado" }));
    const panel = screen.getByRole("dialog", { name: "Elegir fechas" });
    const month = last.from.slice(0, 8);
    const full = (day: string) => new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${day}T12:00:00`));
    await userEvent.click(within(panel).getByRole("button", { name: full(`${month}18`) }));
    await userEvent.click(within(panel).getByRole("button", { name: full(`${month}03`) }));
    expect(panel).toHaveTextContent("16 días");
    expect(panel).toHaveTextContent("Se compara con");
    await userEvent.click(within(panel).getByRole("button", { name: "Aplicar" }));
    await waitFor(() => expect(paths).toContain(`/dashboard/sales?from=${month}03&to=${month}18`));

    // Volver a una cápsula deja el botón como «Fechas».
    await userEvent.click(screen.getByRole("button", { name: "7 días" }));
    expect(screen.getByRole("button", { name: "Elegir fechas" })).toHaveAttribute("aria-pressed", "false");
  });

  it("Atención: chats, en cuánto responden, quién espera, el pico y cada asesor con lo que vende", async () => {
    stub(true);
    page("/dashboard?tab=attention");
    expect(await screen.findByText("Sin responder ahora")).toBeInTheDocument();
    expect(screen.getByText("4 min")).toBeInTheDocument();
    expect(screen.getByText(/Pico:/)).toHaveTextContent("martes, de 8 p. m. a 10 p. m.");
    expect(screen.getByRole("row", { name: /Sofía Rojas/ })).toHaveTextContent("$ 400.000 COP");
    expect(screen.getByRole("link", { name: /Responder a los 5/ })).toBeInTheDocument();
  });

  it("sin acceso al gasto (Asesor): ni franja de anuncios ni pestaña Anuncios", async () => {
    stub(false);
    page("/dashboard?tab=ads");
    const summary = await screen.findByRole("region", { name: "Resumen del periodo" });
    // Sin el gasto no hay ROAS, inversión ni ganancia (la ganancia lo delataría).
    expect(within(summary).getAllByRole("article").map((item) => item.getAttribute("aria-label"))).toEqual(["Facturación", "Ventas", "Compra promedio", "Leads nuevos", "Conversión"]);
    await waitFor(() => expect(screen.queryByRole("tab", { name: "Anuncios" })).not.toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "La plata de tus anuncios" })).not.toBeInTheDocument();
    expect(paths.some((p) => p.startsWith("/dashboard/ads"))).toBe(false);
  });
});

describe("palabras del Dashboard", () => {
  it("tendencias: subir el gasto no es bueno", () => {
    expect(trendText({ change: 0.18 })).toEqual({ text: "▲ 18 %", tone: "good" });
    expect(trendText({ change: 0.1 }, "down")).toEqual({ text: "▲ 10 %", tone: "bad" });
    expect(trendText({ change: null })).toBeNull();
    expect(presetRange("month", new Date(2026, 10, 10))).toEqual({ from: "2026-11-01", to: "2026-11-10" });
  });
});
