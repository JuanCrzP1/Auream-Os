import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../src/features/dashboard/pages/DashboardPage";

// ---------------------------------------------------------------------------
// Junto a las pestañas del Dashboard: la línea de venta, los filtros de varios
// a la vez y la moneda con su bandera. Lo elegido viaja a la API; una línea
// nueva se guarda y queda elegida.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const trend = (value: number) => ({ value, previous: 0, change: null });
const SALES = {
  currency: "COP", missingRates: [], revenue: trend(100), sales: trend(1), averageTicket: 100, leads: trend(1), leadsFromAds: 0, conversion: 1, conversionPrevious: null, convertedLeads: 1,
  reviewCount: 0, ads: null, realProfit: null, profit: trend(100), otherSpend: null, otherExpenses: [], costsKnown: false, daily: [], funnel: null, byHour: Array(24).fill(0), byConnection: [], byProduct: [], byCountry: [], recentSales: [], canSeeAds: true
};
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const LINE = { id: "33333333-3333-4333-8333-333333333333", name: "Venezuela", color: "#e0a400", productIds: [P1], connectionIds: [], campaignIds: ["111"], createdAt: "", updatedAt: "" };

let calls: Array<{ method: string; path: string; body?: unknown }> = [];
beforeEach(() => {
  calls = [];
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname + url.search, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (url.pathname === "/ads/accounts") return reply(200, { connection: { connected: true }, accounts: [], canManage: true, oauthAvailable: false });
    if (url.pathname === "/dashboard/sales") return reply(200, SALES);
    if (url.pathname === "/dashboard/ads") return reply(200, { currency: "COP", level: "campaign", connected: true, measurement: { state: "measured", metaChats: 40, arrivedChats: 38, metaPurchases: 3 }, unseenSales: 0, lateShare: null, lastSyncedAt: null, totals: {}, rows: [{ id: "111", name: "Venezuela · USD", spend: 329200 }, { id: "222", name: "Colombia", spend: 413200 }] });
    if (url.pathname === "/dashboard/fx") return reply(200, { day: "2026-11-12", updatedAt: "2026-11-12T20:02:00.000Z", rates: [{ currency: "VES", perUsd: 904.4485, source: "bcv" }] });
    if (url.pathname === "/connections") return reply(200, { connections: [] });
    if (url.pathname === "/products") return reply(200, { products: [{ id: P1, name: "Mega Pack", status: "active", prices: [] }, { id: P2, name: "Video", status: "active", prices: [] }], canManage: true });
    if (url.pathname === "/sales-lines" && method === "GET") return reply(200, { lines: [LINE], canManage: true });
    if (url.pathname === "/sales-lines" && method === "POST") return reply(201, { ...LINE, id: "44444444-4444-4444-8444-444444444444", name: "Colombia" });
    return reply(404, {});
  }));
});

const page = () => render(<MemoryRouter initialEntries={["/dashboard"]}><DashboardPage /></MemoryRouter>);
const lastSales = () => calls.filter((call) => call.path.startsWith("/dashboard/sales")).at(-1)!.path;

describe("línea, filtros y moneda del Dashboard", () => {
  it("elegir una línea filtra todo el Dashboard y Filtros muestra lo que trae la línea", async () => {
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Línea Todo el negocio/ }));
    await userEvent.click(within(screen.getByRole("menu", { name: "Líneas de venta" })).getByRole("menuitemradio", { name: /Venezuela/ }));
    await waitFor(() => expect(lastSales()).toContain(`line=${LINE.id}`));
    expect(screen.getByRole("button", { name: /Línea Venezuela/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    const filters = screen.getByRole("dialog", { name: "Filtros" });
    expect(within(filters).getByRole("checkbox", { name: "Mega Pack" })).toBeChecked();
    expect(within(filters).getByRole("checkbox", { name: "Video" })).not.toBeChecked();
    // Cambiar un filtro manda sobre la línea: con todo marcado son todos los productos («*»).
    await userEvent.click(within(filters).getByRole("checkbox", { name: "Video" }));
    await waitFor(() => expect(lastSales()).toContain("productIds=*"));
    await userEvent.click(within(filters).getByRole("checkbox", { name: "Mega Pack" }));
    await waitFor(() => expect(lastSales()).toContain(`productIds=${P2}`));
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent("2");
  });

  it("la moneda con su bandera: elegir dólares los pide a la API", async () => {
    page();
    await userEvent.click(await screen.findByRole("button", { name: /COP/ }));
    const menu = screen.getByRole("menu", { name: "Moneda" });
    expect(await within(menu).findByRole("menuitemradio", { name: /VES · Bolívar venezolano.*1 USD = 904,45/ })).toBeInTheDocument();
    expect(menu).toHaveTextContent("El bolívar es la tasa oficial del BCV.");
    await userEvent.click(within(menu).getByRole("menuitemradio", { name: /USD · Dólar estadounidense/ }));
    await waitFor(() => expect(lastSales()).toContain("currency=USD"));
    expect(screen.getByRole("button", { name: /USD/ })).toHaveTextContent("🇺🇸");
  });

  it("la moneda elegida se recuerda al volver al Dashboard; elegir la del negocio la olvida", async () => {
    const first = page();
    await userEvent.click(await screen.findByRole("button", { name: /COP/ }));
    await userEvent.click(within(screen.getByRole("menu", { name: "Moneda" })).getByRole("menuitemradio", { name: /USD · Dólar estadounidense/ }));
    await waitFor(() => expect(lastSales()).toContain("currency=USD"));
    first.unmount();

    // Vuelve desde el menú (sin `currency` en la dirección): sigue en dólares.
    calls = [];
    page();
    await waitFor(() => expect(lastSales()).toContain("currency=USD"));
    await userEvent.click(screen.getByRole("button", { name: /USD/ }));
    const menu = screen.getByRole("menu", { name: "Moneda" });
    expect(within(menu).getByRole("menuitemradio", { name: /COP · Peso colombiano.*La de tu negocio/ })).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole("menuitemradio", { name: /COP · Peso colombiano/ }));
    await waitFor(() => expect(lastSales()).not.toContain("currency="));
    expect(window.localStorage.getItem("auream.dashboard.currency.default")).toBeNull();
  });

  it("crear una línea: la guarda con sus productos y campañas y queda elegida", async () => {
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Línea Todo el negocio/ }));
    await userEvent.click(screen.getByRole("button", { name: "＋ Crear línea" }));
    const dialog = screen.getByRole("dialog", { name: "Crear línea de venta" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Colombia");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Video" }));
    await userEvent.click(await within(dialog).findByRole("checkbox", { name: /^Colombia/ }));
    expect(dialog).toHaveTextContent("Colombia mide las ventas de Video en todos tus números, con el gasto de 1 campaña (Colombia).");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar línea" }));
    await waitFor(() => expect(calls.find((call) => call.method === "POST" && call.path === "/sales-lines")?.body).toMatchObject({ name: "Colombia", productIds: [P2], campaignIds: ["222"], connectionIds: [] }));
    await waitFor(() => expect(lastSales()).toContain("line=44444444"));
  });
});
