import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AdsAccountsResponse } from "@contracts/AdsContracts";
import type { AdsDashboardResponse } from "@contracts/DashboardContracts";
import { MetaAdsPage } from "../../src/features/ads/pages/MetaAdsPage";

// ---------------------------------------------------------------------------
// Meta Ads conectado: conectar con un token, elegir qué cuentas usa Auream,
// el aviso al volver de Meta y la tabla de rendimiento con la venta real
// frente a lo que dice Meta y qué hacer con cada campaña.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const ACCOUNT = { id: "a1", externalId: "act_123", name: "Dilo cantando", currency: "COP", timezone: "America/Bogota", active: true, enabled: false, lastSyncedAt: null, lastError: null };
const connected = (enabled: boolean): AdsAccountsResponse => ({
  connection: { connected: true, method: "token", userName: "Camilo", expiresAt: null, needsReconnect: false, lastError: null },
  accounts: [{ ...ACCOUNT, enabled, lastSyncedAt: enabled ? new Date().toISOString() : null }],
  canManage: true,
  oauthAvailable: false
});
const metrics = { spend: 100000, impressions: 20000, clicks: 600, chats: 40, sales: 10, metaPurchases: 3, revenue: 500000, metaRevenue: 150000, profit: 400000, roas: 5, roasMeta: 1.5, costPerChat: 2500, costPerSale: 10000, ctr: 0.03 };
const PERFORMANCE: AdsDashboardResponse = {
  currency: "COP", level: "campaign", connected: true, unseenSales: 7, lateShare: 0.2, lastSyncedAt: new Date().toISOString(), totals: metrics,
  rows: [
    { ...metrics, id: "c1", name: "Video Colombia", level: "campaign", status: "ACTIVE", parentName: null, dailyBudget: 15000, thumbnailUrl: null, advice: "scale", adviceReason: "Deja 5 por cada 1 que gastas." },
    { ...metrics, id: "c2", name: "Navidad", level: "campaign", status: "PAUSED", parentName: null, dailyBudget: null, thumbnailUrl: null, spend: 40000, sales: 0, revenue: 0, profit: -40000, roas: 0, advice: "pause", adviceReason: "18 chats y ninguna venta." }
  ]
};

let calls: Array<{ method: string; path: string; body: unknown }> = [];
function stub(initial: AdsAccountsResponse | "none") {
  calls = [];
  let state = initial === "none" ? { ...connected(false), connection: { ...connected(false).connection, connected: false }, accounts: [] } : initial;
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname + url.search, body });
    if (url.pathname === "/pixel-connections") return reply(200, { connections: [] });
    if (url.pathname === "/ads/meta/token") return reply(200, (state = connected(true)));
    if (url.pathname === "/ads/accounts/a1" && method === "PATCH") return reply(200, (state = connected(body.enabled)));
    if (url.pathname === "/ads/accounts") return reply(200, state);
    if (url.pathname === "/dashboard/ads") return reply(200, PERFORMANCE);
    return reply(404, {});
  }));
}

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><MetaAdsPage /></MemoryRouter>);

beforeEach(() => vi.restoreAllMocks());

describe("Meta Ads conectado", () => {
  it("conectar con un token guarda la cuenta y la muestra con su interruptor", async () => {
    stub("none");
    renderAt("/meta-ads?tab=accounts");
    await userEvent.click(await screen.findByRole("button", { name: /Pégalo aquí/ }));
    const dialog = screen.getByRole("dialog", { name: "Conectar con un token" });
    await userEvent.type(within(dialog).getByLabelText("Token de acceso"), "EAAB" + "x".repeat(30));
    await userEvent.click(within(dialog).getByRole("button", { name: "Conectar" }));
    await waitFor(() => expect(calls).toContainEqual({ method: "POST", path: "/ads/meta/token", body: { accessToken: "EAAB" + "x".repeat(30) } }));
    expect(await screen.findByRole("heading", { name: "Meta conectado" })).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("elegir una cuenta la activa en Auream; volver de Meta muestra el aviso", async () => {
    stub(connected(false));
    renderAt("/meta-ads?tab=accounts&meta=connected");
    expect(screen.getByRole("status")).toHaveTextContent("Meta quedó conectado");
    await userEvent.click(await screen.findByRole("switch"));
    await waitFor(() => expect(calls).toContainEqual({ method: "PATCH", path: "/ads/accounts/a1", body: { enabled: true } }));
    expect(await screen.findByText(/Actualizada/)).toBeInTheDocument();
  });

  it("Rendimiento: ROAS real frente a Meta, qué hacer con cada campaña y el total", async () => {
    stub(connected(true));
    renderAt("/meta-ads?tab=performance");
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Video Colombia")).toBeInTheDocument();
    expect(within(table).getByText("Escalar")).toBeInTheDocument();
    expect(within(table).getByText("Apagar")).toBeInTheDocument();
    expect(within(table).getAllByText("5x").length).toBeGreaterThan(0);
    expect(screen.getByText(/ROAS real 5x · Meta dice 1,5x/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Anuncios" }));
    await waitFor(() => expect(calls.some((call) => call.path.startsWith("/dashboard/ads") && call.path.includes("level=ad"))).toBe(true));
  });

  it("un rol sin acceso a los anuncios lo ve explicado", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => (String(input).includes("/ads/accounts") ? reply(403, { message: "no" }) : reply(200, { connections: [] }))));
    renderAt("/meta-ads?tab=accounts");
    expect(await screen.findByText(/los ven los dueños y administradores/)).toBeInTheDocument();
  });
});
