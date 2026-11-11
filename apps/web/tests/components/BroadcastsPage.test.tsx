import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { BroadcastDetailResponse, BroadcastListResponse, BroadcastSummary } from "@contracts/BroadcastResultsContracts";
import { DEFAULT_BROADCAST_SETTINGS, EMPTY_AUDIENCE } from "@contracts/BroadcastContracts";
import { BroadcastsPage } from "../../src/features/broadcasts/pages/BroadcastsPage";
import { previewText } from "../../src/features/broadcasts/wizard/PhonePreview";

// ---------------------------------------------------------------------------
// Difusiones: la lista con lo que vendió cada una, crear una en 4 pasos (solo
// números por QR conectados; a cuántos les llega en vivo) y cada difusión por
// dentro: del envío a la venta, pausar y cada persona con su resultado.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const STATS = { total: 826, pending: 314, sent: 512, failed: 4, skipped: 0, delivered: 498, read: 312, replied: 84, optedOut: 3, bought: 9, revenue: [{ currency: "COP", amount: 449100 }] };
const BROADCAST: BroadcastSummary = {
  id: ID, name: "Promo Día de la Madre", status: "sending", statusReason: null, parentId: null, parentName: null,
  variants: [{ content: { kind: "flow", automationId: "f1" }, flowName: "Oferta mamá" }], audience: EMPTY_AUDIENCE, connections: [{ id: "c1", name: "Ventas 1" }],
  settings: DEFAULT_BROADCAST_SETTINGS, abTest: null, followUp: { afterHours: 48, content: { kind: "message", text: "¿Lo pensaste?", media: null }, dueAt: null, childId: null },
  scheduledAt: null, startedAt: "2026-11-10T15:00:00.000Z", finishedAt: null, createdAt: "2026-11-10T15:00:00.000Z", stats: STATS
};
const LIST = (canManage: boolean): BroadcastListResponse => ({ broadcasts: [BROADCAST], month: { broadcasts: 1, sent: 512, read: 312, replied: 84, bought: 9, revenue: STATS.revenue, autoPaused: 0 }, canManage });
const DETAIL: BroadcastDetailResponse = { broadcast: BROADCAST, variants: [], numbers: [{ connectionId: "c1", name: "Ventas 1", sentToday: 212, capToday: 300, warmupDay: null, connected: true }], nextSendAt: null, canManage: true };

let calls: Array<{ method: string; path: string; body: unknown }> = [];
function stub(canManage = true) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname + url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/broadcasts" && method === "GET") return reply(200, LIST(canManage));
    if (url.pathname === "/broadcasts" && method === "POST") return reply(201, { ...BROADCAST, id: ID });
    if (url.pathname === `/broadcasts/${ID}`) return reply(200, DETAIL);
    if (url.pathname === `/broadcasts/${ID}/pause`) return reply(200, BROADCAST);
    if (url.pathname === `/broadcasts/${ID}/recipients`) {
      return reply(200, { recipients: [{ id: "r1", contactId: "k1", name: "Laura Gómez", phone: "573001110001", connectionName: "Ventas 1", state: "bought", variant: 0, sentAt: new Date().toISOString(), error: null, sale: { currency: "COP", amount: 49900 } }], counts: { all: 512, bought: 9, replied: 84, read: 312, unread: 186, failed: 4 }, nextOffset: null });
    }
    if (url.pathname === "/broadcasts/audience/preview") return reply(200, { count: 1248, perConnection: [{ connectionId: "c1", count: 1248 }], optedOut: 62, overLimit: 0, sample: [{ name: "Laura Gómez", phone: "573001110001" }], days: 5, numbers: [{ connectionId: "c1", name: "Ventas 1", sentToday: 0, capToday: 20, warmupDay: 1, connected: true }] });
    if (url.pathname === "/broadcasts/audiences") return reply(200, { audiences: [] });
    if (url.pathname === "/automations") return reply(200, { flows: [{ id: "f1", name: "Oferta mamá", status: "active" }] });
    if (url.pathname === "/connections") return reply(200, { connections: [{ id: "c1", name: "Ventas 1", method: "qr", status: "connected" }, { id: "c2", name: "Oficial", method: "cloud_api", status: "connected" }] });
    if (url.pathname === "/labels") return reply(200, { labels: [{ id: "l1", name: "VIP", color: "#6c5ce7" }] });
    if (url.pathname === "/crm/pipelines") return reply(200, { pipelines: [], members: [], canWrite: true, canManage: true });
    return reply(404, {});
  }));
}

const page = (path = "/broadcasts") => render(<MemoryRouter initialEntries={[path]}><BroadcastsPage /></MemoryRouter>);

beforeEach(() => vi.restoreAllMocks());

describe("Difusiones", () => {
  it("la lista: lo vendido este mes y cada difusión con su resultado", async () => {
    stub();
    page();
    const hero = await screen.findByRole("region", { name: "Difusiones este mes" });
    expect(within(hero).getByText("$ 449.100 COP")).toBeInTheDocument();
    const row = screen.getByRole("button", { name: "Abrir Promo Día de la Madre" });
    expect(row).toHaveTextContent("Enviando · 62 %");
    expect(row).toHaveTextContent("Flujo «Oferta mamá»");
    expect(screen.getByRole("button", { name: "+ Nueva difusión" })).toBeInTheDocument();
  });

  it("quien no puede enviar ve los resultados pero no crea", async () => {
    stub(false);
    page();
    await screen.findByRole("region", { name: "Difusiones este mes" });
    expect(screen.queryByRole("button", { name: "+ Nueva difusión" })).not.toBeInTheDocument();
  });

  it("nueva difusión: 4 pasos, el alcance en vivo, solo números por QR, y se envía", async () => {
    stub();
    page("/broadcasts?view=new");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Flujo" }), "f1");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    const reach = screen.getByRole("region", { name: "A cuántos les llega" });
    await waitFor(() => expect(reach).toHaveTextContent("1.248"));
    expect(reach).toHaveTextContent("62 pidieron no recibir más");
    await userEvent.click(screen.getByRole("button", { name: /VIP/ }));
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("button", { name: /Oficial/ })).toBeDisabled();
    expect(screen.getByText(/Calentando · día 1 de 7/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Nombre de la difusión" }), "Promo");
    await userEvent.click(await screen.findByRole("button", { name: "Enviar a 1.248 personas" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/broadcasts")).toBe(true));
    const sent = calls.find((c) => c.method === "POST" && c.path === "/broadcasts")!.body as Record<string, unknown>;
    expect(sent).toMatchObject({ name: "Promo", variants: [{ kind: "flow", automationId: "f1" }], connectionIds: ["c1"], scheduledAt: null, audience: { labelIds: ["l1"], lastInboundDays: 60 }, abTest: null });
    expect(sent["followUp"]).toMatchObject({ afterHours: 48, content: { kind: "message" } });
  });

  it("una difusión: del envío a la venta, pausar y cada persona con lo que compró", async () => {
    stub();
    page(`/broadcasts?id=${ID}`);
    const funnel = await screen.findByRole("region", { name: "Del envío a la venta" });
    expect(funnel).toHaveTextContent("$ 449.100 COP");
    expect(funnel).toHaveTextContent("cada 100 mensajes dejaron $ 87.715 COP");
    expect(screen.getByText("212 / 300")).toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /Laura Gómez/ })).toHaveTextContent("$ 49.900 COP");
    await userEvent.click(screen.getByRole("button", { name: "❚❚ Pausar" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === `/broadcasts/${ID}/pause`)).toBe(true));
  });

  it("la primera vez: vende la idea, cuenta cómo funciona y lleva a crear la primera", async () => {
    stub();
    const empty = { ...LIST(true), broadcasts: [], month: { ...LIST(true).month, broadcasts: 0 } };
    const base = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => (new URL(String(input), "http://api.test").pathname === "/broadcasts" && (init?.method ?? "GET") === "GET" ? reply(200, empty) : base(input, init))));
    page();
    const hero = await screen.findByRole("region", { name: "Tu primera difusión" });
    expect(hero).toHaveTextContent("Envía tu primera difusión");
    expect(within(hero).getByRole("list", { name: "Cómo funciona" })).toHaveTextContent("Ves quién leyó, respondió y compró");
    expect(screen.queryByRole("button", { name: "+ Nueva difusión" })).not.toBeInTheDocument();
    await userEvent.click(within(hero).getByRole("button", { name: "Crear difusión" }));
    expect(await screen.findByRole("heading", { name: "Nueva difusión" })).toBeInTheDocument();
  });

  it("la vista previa pone el nombre sin dejar huecos", () => {
    expect(previewText("Hola {first_name} 👋", "Laura Gómez")).toBe("Hola Laura 👋");
    expect(previewText("Hola {first_name}, ¿te muestro?", null)).toBe("Hola, ¿te muestro?");
  });
});
