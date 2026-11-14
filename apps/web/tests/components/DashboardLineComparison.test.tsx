import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { LineComparisonResponse, LineComparisonRow } from "@contracts/LineComparisonContracts";
import { DashboardPage } from "../../src/features/dashboard/pages/DashboardPage";

// ---------------------------------------------------------------------------
// Comparar líneas: mirando todo el negocio, cada línea con su plata (de la que
// más gana a la que menos) y el total; tocar una línea la elige. Sin ver el
// gasto, solo lo vendido. Con una línea elegida no se muestra.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const trend = (value: number, previous = 0) => ({ value, previous, change: previous ? (value - previous) / previous : null });
const SALES = {
  currency: "COP", missingRates: [], revenue: trend(100), sales: trend(1), averageTicket: 100, leads: trend(1), leadsFromAds: 0, conversion: 1, conversionPrevious: null, convertedLeads: 1,
  reviewCount: 0, ads: null, realProfit: null, profit: trend(100), otherSpend: null, otherExpenses: [], costsKnown: false, daily: [], funnel: null, byHour: Array(24).fill(0), byConnection: [], byProduct: [], byCountry: [], recentSales: [], canSeeAds: true
};
const VE = "33333333-3333-4333-8333-333333333333";
const CO = "44444444-4444-4444-8444-444444444444";
const row = (id: string | null, name: string, extra: Partial<LineComparisonRow>): LineComparisonRow => ({
  id, name, color: "#e0a400", revenue: trend(500_000, 250_000), sales: 5, averageTicket: 100_000, share: 0.63, hasCampaigns: true,
  spend: 100_000, roas: 4, roasMeta: 1.5, otherSpend: 0, profit: trend(400_000, 200_000), margin: 0.8, ...extra
});
const COMPARISON: LineComparisonResponse = {
  currency: "COP", missingRates: [], canSeeAds: true, overlapping: false,
  rows: [row(VE, "Venezuela", {}), row(CO, "Colombia", { hasCampaigns: false, spend: null, roas: null, otherSpend: 20_000, profit: trend(-30_000, 10_000), margin: -0.15, share: 0.25 })],
  total: row(null, "Todo el negocio", { revenue: trend(800_000, 400_000), profit: trend(580_000, 290_000), share: 1 })
};

let paths: string[] = [];
function stub(comparison: LineComparisonResponse) {
  paths = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(String(input), "http://api.test");
    paths.push(url.pathname + url.search);
    if (url.pathname === "/ads/accounts") return reply(200, { connection: { connected: true }, accounts: [], canManage: true, oauthAvailable: false });
    if (url.pathname === "/dashboard/sales") return reply(200, SALES);
    if (url.pathname === "/dashboard/lines") return reply(200, comparison);
    if (url.pathname === "/dashboard/ads") return reply(200, { currency: "COP", level: "campaign", connected: true, measurement: { state: "measured", metaChats: 40, arrivedChats: 38, metaPurchases: 3 }, unseenSales: 0, lateShare: null, lastSyncedAt: null, totals: {}, rows: [] });
    if (url.pathname === "/connections") return reply(200, { connections: [] });
    if (url.pathname === "/products") return reply(200, { products: [], canManage: false });
    if (url.pathname === "/sales-lines") return reply(200, { lines: [{ id: VE, name: "Venezuela", color: "#e0a400", productIds: [], connectionIds: [], campaignIds: [], createdAt: "", updatedAt: "" }], canManage: true });
    return reply(404, {});
  }));
}

const page = (path = "/dashboard") => render(<MemoryRouter initialEntries={[path]}><DashboardPage /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Comparar líneas", () => {
  it("cada línea con su plata y el total; avisa cuál pierde y la que no tiene campañas", async () => {
    stub(COMPARISON);
    page("/dashboard?period=lastMonth&currency=USD");
    const card = await screen.findByRole("region", { name: "Comparar líneas" });
    expect(card).toHaveTextContent("Venezuela es la que más te deja: $ 400.000 COP. Colombia pierde plata: revisa su gasto.");
    expect(paths.find((p) => p.startsWith("/dashboard/lines"))).toMatch(/from=.*&to=.*&currency=USD/);

    const venezuela = within(card).getByRole("row", { name: /Venezuela/ });
    expect(venezuela).toHaveTextContent("63 % de lo vendido");
    expect(within(venezuela).getByText("4x")).toBeInTheDocument();
    expect(venezuela).toHaveTextContent("▲ 100 %");
    const colombia = within(card).getByRole("row", { name: /Colombia/ });
    expect(colombia).toHaveTextContent("Sin campañas");
    expect(within(colombia).getByText("$ -30.000 COP").closest("td")).toHaveClass("is-bad");
    expect(within(card).getByRole("row", { name: /Todo el negocio/ })).toHaveTextContent("$ 580.000 COP");
    expect(card).toHaveTextContent("no resta gasto en Meta");
  });

  it("tocar una línea la elige en todo el Dashboard (y la tarjeta se va)", async () => {
    stub(COMPARISON);
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Ver la línea Venezuela" }));
    await waitFor(() => expect(paths.at(-1)).toContain(`line=${VE}`));
    expect(await screen.findByRole("button", { name: /Línea Venezuela/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Comparar líneas" })).not.toBeInTheDocument();
  });

  it("sin ver el gasto: solo lo vendido; sin líneas no se muestra", async () => {
    const sales = (r: LineComparisonRow) => ({ ...r, spend: null, roas: null, otherSpend: null, profit: null, margin: null });
    stub({ ...COMPARISON, canSeeAds: false, rows: COMPARISON.rows.map(sales), total: sales(COMPARISON.total) });
    const first = page();
    const card = await screen.findByRole("region", { name: "Comparar líneas" });
    expect(within(card).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Línea", "Facturación", "Ventas", "Compra promedio", "Del negocio"]);
    expect(card).toHaveTextContent("Venezuela es la que más vende");
    first.unmount();

    stub({ ...COMPARISON, rows: [] });
    page();
    await screen.findByRole("region", { name: "Resumen del periodo" });
    await waitFor(() => expect(paths.some((p) => p.startsWith("/dashboard/lines"))).toBe(true));
    expect(screen.queryByRole("region", { name: "Comparar líneas" })).not.toBeInTheDocument();
  });
});
