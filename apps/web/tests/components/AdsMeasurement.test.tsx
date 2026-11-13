import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AdMeasurement } from "@contracts/AdMeasurementContracts";
import type { AdsDashboardResponse, SalesDashboardResponse } from "@contracts/DashboardContracts";
import { measurementCopy } from "@shared/ads/measurementText";
import { PerformanceSection } from "../../src/features/ads/components/PerformanceSection";
import { AdsTab } from "../../src/features/dashboard/ads/AdsTab";
import { AdsHero } from "../../src/features/dashboard/sales/AdsHero";
import { summaryCards } from "../../src/features/dashboard/sales/summary/summaryCards";

// ---------------------------------------------------------------------------
// Cuando Auream no ve lo que venden los anuncios (los chats llegan a otra
// herramienta, el número se conectó hace poco o el negocio no anota ventas),
// las tres pantallas lo dicen igual: un aviso con qué hacer, «Sin medir» en
// vez de «Apagar», y rayas (no ceros ni pérdidas en rojo) en lo que depende
// de las ventas. Lo que reporta Meta se sigue viendo.
// ---------------------------------------------------------------------------

const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;
const trend = (value: number, previous: number) => ({ value, previous, change: null });
const NONE: AdMeasurement = { state: "none", metaChats: 4726, arrivedChats: 0, metaPurchases: 805 };
const blind = { spend: 1_750_508, impressions: 90000, clicks: 2100, chats: 1779, arrivedChats: 0, sales: 0, metaPurchases: 299, revenue: 0, metaRevenue: 350_000, profit: null, roas: null, roasMeta: 0.2, costPerChat: 984, costPerSale: null, ctr: 0.02 };

const performance = (measurement: AdMeasurement = NONE): AdsDashboardResponse => ({
  currency: "COP", level: "campaign", connected: true, measurement, unseenSales: 0, lateShare: null, lastSyncedAt: null,
  totals: { ...blind, spend: 4_681_440, chats: 4726, metaPurchases: 805 },
  rows: [
    { ...blind, id: "c1", name: "dilo cantando (7926)", level: "campaign", status: "ACTIVE", parentName: null, dailyBudget: null, thumbnailUrl: null, advice: "unmeasured", adviceReason: "Sus 1.779 chats no llegan a Auream: no hay con qué juzgarla." },
    { ...blind, id: "c2", name: "nueva", level: "campaign", status: "PAUSED", parentName: null, dailyBudget: null, thumbnailUrl: null, spend: 0, chats: 0, metaPurchases: 1, advice: "learning", adviceReason: "Gastó poco: aún no hay con qué juzgarla." }
  ]
});

const sales = (measurement: AdMeasurement): SalesDashboardResponse => ({
  currency: "COP", missingRates: [], revenue: trend(0, 0), sales: trend(0, 0), averageTicket: null, leads: trend(0, 0), leadsFromAds: 0, conversion: null, conversionPrevious: null, convertedLeads: 0, reviewCount: 0,
  ads: { spend: trend(4_681_440, 0), revenue: trend(0, 0), profit: trend(-4_681_440, 0), realProfit: null, roas: null, roasMeta: 0.2, costPerSale: null, costPerChat: 991, revenuePerChat: null, chats: 4726, attributedSales: 0, impressions: 90000, clicks: 2100, activeCampaigns: 5, measurement },
  realProfit: null, profit: trend(-4_681_440, 0), otherSpend: null, otherExpenses: [], costsKnown: false,
  daily: [], funnel: null, byHour: [], byConnection: [], byProduct: [], byCountry: [], recentSales: [], canSeeAds: true, canExport: false
});

const serve = (body: AdsDashboardResponse) => vi.stubGlobal("fetch", vi.fn(async () => reply(body)));

beforeEach(() => vi.restoreAllMocks());

describe("el aviso, con las mismas palabras en todas partes", () => {
  it("dice qué pasa y qué hacer en cada caso; midiendo todo no hay aviso", () => {
    expect(measurementCopy(NONE)).toMatchObject({ title: "Auream aún no ve los chats de tus anuncios", action: { label: "Conectar un número", to: "/connections" } });
    expect(measurementCopy({ state: "partial", metaChats: 4726, arrivedChats: 1182, metaPurchases: 0 })!.body).toContain("llegaron 1.182 de los 4.726 chats que cobró Meta (25 %)");
    expect(measurementCopy({ state: "partial", metaChats: 4726, arrivedChats: 13, metaPurchases: 0 })!.body).toContain("llegaron 13 de los 4.726 chats que cobró Meta (menos del 1 %)");
    expect(measurementCopy({ state: "unsold", metaChats: 4726, arrivedChats: 4500, metaPurchases: 805 })!.body).toContain("no hay ventas anotadas de esos clientes y Meta cuenta 805. Sin ventas no se puede decir qué campaña rinde");
    expect(measurementCopy({ state: "unsold", metaChats: 40, arrivedChats: 38, metaPurchases: 0 })!.body).not.toContain("Meta cuenta");
    expect(measurementCopy({ state: "measured", metaChats: 40, arrivedChats: 38, metaPurchases: 3 })).toBeNull();
  });
});

describe("Meta Ads › Rendimiento sin medición", () => {
  it("avisa, no manda a apagar y deja rayas donde no se sabe; lo de Meta se ve", async () => {
    serve(performance());
    render(<MemoryRouter><PerformanceSection onConnectAccount={() => {}} /></MemoryRouter>);
    const notice = await screen.findByRole("status", { name: "Auream aún no ve los chats de tus anuncios" });
    expect(notice).toHaveTextContent("Meta cobró 4.726 chats en este periodo y a Auream no llegó ninguno");
    expect(within(notice).getByRole("link", { name: "Conectar un número" })).toHaveAttribute("href", "/connections");
    expect(screen.getByText(/ROAS real sin medir · Meta dice 0,2x/)).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).queryByText("Apagar")).toBeNull();
    const row = within(table).getByText("dilo cantando (7926)").closest("tr")!;
    expect(within(row).getByText("Sin medir")).toBeInTheDocument();
    expect(row).toHaveTextContent("Sus 1.779 chats no llegan a Auream");
    // Gasto, chats y costo por chat (de Meta) sí; ventas, facturación, ganancia y ROAS de Auream, con raya.
    const cells = [...row.querySelectorAll("td")].slice(2).map((cell) => cell.textContent);
    expect(cells).toEqual(["$ 1.750.508", "1.779", "$ 984", "— / 299", "—", "—", "— / 0,2x", "—"]);
    expect(row.querySelector(".ads-table__bad")).toBeNull();
    expect(table.querySelector("tfoot")).toHaveTextContent("— / 805");
  });
});

describe("Dashboard sin medición", () => {
  it("Anuncios: el aviso arriba, ROAS y ganancia con raya y sin «¿Por qué Meta dice menos?»", async () => {
    serve(performance());
    render(<MemoryRouter><AdsTab filters={{}} /></MemoryRouter>);
    expect(await screen.findByRole("status", { name: "Auream aún no ve los chats de tus anuncios" })).toBeInTheDocument();
    const tops = screen.getByRole("region", { name: "Resumen de anuncios" });
    expect(tops).toHaveTextContent("ROAS real—Meta dice 0,2x");
    expect(tops).toHaveTextContent("Ganancia—Auream aún no ve esas ventas");
    expect(tops).toHaveTextContent("Costo por venta—sin ventas que mirar");
    expect(screen.queryByText("¿Por qué Meta dice menos?")).toBeNull();
  });

  it("Anuncios midiendo todo: sin aviso y con la explicación de siempre", async () => {
    serve(performance({ state: "measured", metaChats: 4726, arrivedChats: 4500, metaPurchases: 805 }));
    render(<MemoryRouter><AdsTab filters={{}} /></MemoryRouter>);
    expect(await screen.findByText("¿Por qué Meta dice menos?")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("Ventas: la franja no dice «0x» ni una pérdida; el resumen marca el ROAS como sin medir", () => {
    render(<AdsHero view={sales(NONE)} periodWords="últimos 30 días" />);
    const hero = screen.getByRole("region", { name: "La plata de tus anuncios" });
    expect(hero).toHaveTextContent("ROAS real · últimos 30 días—Auream aún no ve los chats de tus anuncios: no hay con qué calcularlo.Meta dice 0,2x");
    expect(hero).toHaveTextContent("Facturación por anuncios—Auream aún no ve esas ventas");
    expect(hero).toHaveTextContent("Ganancia (ventas − anuncios)—sin esas ventas no se puede calcular");
    expect(hero).toHaveTextContent("Gasto en Meta$ 4.681.440");
    expect(hero).not.toHaveTextContent("4.681.440 COP−");

    const roas = summaryCards(sales(NONE)).find((card) => card.id === "roas")!;
    expect(roas).toMatchObject({ value: "—", note: "Sin medir · Meta dice 0,2x", trend: null });
  });

  it("Ventas con medición parcial: los números se ven, con la advertencia de que falta una parte", () => {
    const partial = sales({ state: "partial", metaChats: 4726, arrivedChats: 1182, metaPurchases: 0 });
    render(<AdsHero view={{ ...partial, ads: { ...partial.ads!, roas: 0.4, attributedSales: 6, revenue: trend(1_900_000, 0), profit: trend(-2_781_440, 0) } }} periodWords="últimos 30 días" />);
    const hero = screen.getByRole("region", { name: "La plata de tus anuncios" });
    expect(hero).toHaveTextContent("0,4x");
    expect(hero).toHaveTextContent("Medición parcial: a Auream llegaron 1.182 de 4.726 chats de tus anuncios.");
    expect(hero).toHaveTextContent("Facturación por anuncios$ 1.900.000");
  });

  it("Ventas con medición parcial y ninguna venta todavía: rayas, no «0x»", () => {
    render(<AdsHero view={sales({ state: "partial", metaChats: 4726, arrivedChats: 1182, metaPurchases: 0 })} periodWords="últimos 30 días" />);
    const hero = screen.getByRole("region", { name: "La plata de tus anuncios" });
    expect(hero).toHaveTextContent("ROAS real · últimos 30 días—Medición parcial: a Auream llegaron 1.182 de 4.726 chats de tus anuncios.");
    expect(hero).toHaveTextContent("Facturación por anuncios—");
  });
});
