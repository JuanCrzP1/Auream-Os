import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../src/features/dashboard/pages/DashboardPage";

// ---------------------------------------------------------------------------
// Otros gastos desde la tarjeta de inversión: sin gastos el formulario ya está
// abierto; guardar manda lo escrito tal cual (la API lo lee) y el Dashboard
// vuelve a pedir la ganancia. Con gastos, la tarjeta deja elegir Meta · Otros
// · Todo.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const trend = (value: number, previous = 0) => ({ value, previous, change: null });
const SALES = {
  currency: "COP", missingRates: [], revenue: trend(1_000_000), sales: trend(10), averageTicket: 100_000, leads: trend(10), leadsFromAds: 0, conversion: 0.5, conversionPrevious: null, convertedLeads: 5,
  reviewCount: 0, ads: null, realProfit: null, profit: trend(1_000_000), otherSpend: null, otherExpenses: [], costsKnown: false, daily: [], funnel: null, byHour: Array(24).fill(0),
  byConnection: [], byProduct: [], byCountry: [], recentSales: [], canSeeAds: true
};
const NOMINA = { id: "55555555-5555-4555-8555-555555555555", name: "Nómina", kind: "fixed", amount: 1_200_000, currency: "COP", frequency: "monthly", startsOn: "2026-11-01", endsOn: null, lineId: null, createdAt: "", updatedAt: "" };

let calls: Array<{ method: string; path: string; body?: unknown }> = [];
let expenses: unknown[] = [];
let sales: Record<string, unknown> = SALES;
beforeEach(() => {
  calls = [];
  expenses = [];
  sales = SALES;
  vi.restoreAllMocks();
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (url.pathname === "/dashboard/sales") return reply(200, sales);
    if (url.pathname === "/dashboard/fx") return reply(200, { day: "2026-11-12", updatedAt: "2026-11-12T20:02:00.000Z", rates: [] });
    if (url.pathname === "/ads/accounts") return reply(200, { connection: { connected: false }, accounts: [], canManage: true, oauthAvailable: false });
    if (url.pathname === "/sales-lines") return reply(200, { lines: [], canManage: true });
    if (url.pathname === "/other-expenses" && method === "GET") return reply(200, { expenses, canManage: true });
    if (url.pathname === "/other-expenses" && method === "POST") {
      expenses = [NOMINA];
      return reply(201, NOMINA);
    }
    if (url.pathname === "/connections") return reply(200, { connections: [] });
    if (url.pathname === "/products") return reply(200, { products: [], canManage: true });
    return reply(404, {});
  }));
});

const page = () => render(<MemoryRouter initialEntries={["/dashboard"]}><DashboardPage /></MemoryRouter>);
const salesRequests = () => calls.filter((call) => call.path === "/dashboard/sales").length;

describe("Otros gastos en el Dashboard", () => {
  it("se crea el primero desde la tarjeta y el Dashboard vuelve a calcular", async () => {
    page();
    const card = await screen.findByRole("article", { name: "Inversión en Meta" });
    await userEvent.click(within(card).getByRole("button", { name: "Otros gastos" }));
    const dialog = await screen.findByRole("dialog", { name: "Otros gastos" });
    const form = await within(dialog).findByRole("form", { name: "Nuevo gasto" });
    await userEvent.type(within(form).getByLabelText("Nombre"), "Nómina");
    await userEvent.type(within(form).getByLabelText("Valor"), "1.200.000");
    expect(within(form).getByText(/Se restan \$ 1\.200\.000 COP cada mes/)).toBeInTheDocument();
    const before = salesRequests();
    await userEvent.click(within(form).getByRole("button", { name: "Guardar gasto" }));

    await waitFor(() => expect(salesRequests()).toBeGreaterThan(before));
    expect(calls.find((call) => call.method === "POST" && call.path === "/other-expenses")?.body).toMatchObject({ name: "Nómina", kind: "fixed", amount: "1.200.000", currency: "COP", frequency: "monthly", lineId: null });
    expect(await within(dialog).findByRole("button", { name: "Editar Nómina" })).toBeInTheDocument();
  });

  it("con gastos, la tarjeta se llama Inversión y deja elegir qué ver", async () => {
    sales = { ...SALES, otherSpend: trend(1_200_000, 1_000_000), otherExpenses: [{ id: NOMINA.id, name: "Nómina", amount: 1_200_000 }] };
    page();
    const card = await screen.findByRole("article", { name: "Inversión" });
    expect(within(card).getByText("$ 1.200.000 COP")).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Otros" }));
    expect(within(card).getByText(/1 gasto: Nómina/)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Otros" })).toHaveAttribute("aria-pressed", "true");
  });
});
