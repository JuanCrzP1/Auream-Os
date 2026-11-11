import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { CampaignDetailResponse, CampaignSummary, GroupsOverviewResponse } from "@contracts/GroupContracts";
import { GroupsPage } from "../../src/features/groups/pages/GroupsPage";

// ---------------------------------------------------------------------------
// Grupos: la primera vez, la portada con lo vendido y cada campaña, la
// campaña por dentro (enlace, del clic a la venta, grupos), crear una
// campaña y enviar a sus grupos.
// ---------------------------------------------------------------------------

vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,AAA" } }));

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const STATS = { clicks: 3612, joined: 2818, left: 188, members: 2630, buyers: 78, revenue: [{ currency: "COP", amount: 3912000 }] };
const CAMPAIGN: CampaignSummary = {
  id: ID, name: "Lanzamiento Navidad", slug: "navidad", link: "https://app.test/g/navidad", status: "active", connections: [{ id: "c1", name: "Ventas 1" }], capacity: 1000,
  template: { namePattern: "Navidad", description: "", imageUrl: null, announce: true, locked: true },
  rules: { welcome: { enabled: true, text: "¡Bienvenidos {nombres}!", everyMinutes: 15 }, labelOnJoin: true },
  groups: [{ id: "g1", name: "Navidad #1", members: 1000, state: "full", position: 1 }, { id: "g2", name: "Navidad #2", members: 640, state: "open", position: 2 }],
  current: { groupId: "g2", name: "Navidad #2", free: 360 }, stats: STATS, createdAt: "2026-11-01T00:00:00.000Z"
};
const OVERVIEW = (campaigns: CampaignSummary[]): GroupsOverviewResponse => ({ campaigns, month: STATS, canManage: true, hasNumbers: true });
const GROUP = { id: "g2", connectionId: "c1", connectionName: "Ventas 1", name: "Navidad #2", description: "", imageUrl: null, campaignId: ID, campaignName: "Lanzamiento Navidad", position: 2, state: "open" as const, isAdmin: true, announce: true, locked: true, syncedAt: null, members: 640, joined: 770, left: 43, buyers: 12, revenue: [{ currency: "COP", amount: 618600 }] };
const DETAIL: CampaignDetailResponse = { campaign: CAMPAIGN, groups: [GROUP], posts: [], daily: [{ day: "2026-11-10", clicks: 40, joined: 30, left: 2 }], canManage: true };

let calls: Array<{ method: string; path: string; body: unknown }> = [];
function stub(campaigns: CampaignSummary[]) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/groups") return reply(200, OVERVIEW(campaigns));
    if (url.pathname === "/groups/list") return reply(200, { groups: [GROUP], syncedAt: null, canManage: true });
    if (url.pathname === `/groups/campaigns/${ID}`) return reply(200, DETAIL);
    if (url.pathname === "/groups/campaigns" && method === "POST") return reply(201, CAMPAIGN);
    if (url.pathname === "/groups/posts") return reply(201, {});
    if (url.pathname === "/connections") return reply(200, { connections: [{ id: "c1", name: "Ventas 1", method: "qr", status: "connected" }] });
    return reply(404, {});
  }));
}
const page = (path = "/groups") => render(<MemoryRouter initialEntries={[path]}><GroupsPage /></MemoryRouter>);

beforeEach(() => vi.restoreAllMocks());

describe("Grupos", () => {
  it("la primera vez vende la idea y lleva a crear la primera campaña", async () => {
    stub([]);
    page();
    const hero = await screen.findByRole("region", { name: "Tu primera campaña de grupos" });
    expect(hero).toHaveTextContent("Crea tu primera campaña de grupos");
    expect(within(hero).getByRole("button", { name: "Traer mis grupos" })).toBeInTheDocument();
    await userEvent.click(within(hero).getByRole("button", { name: "Crear campaña" }));
    expect(await screen.findByRole("heading", { name: "Nueva campaña de grupos" })).toBeInTheDocument();
  });

  it("la portada: lo vendido este mes y cada campaña llenándose", async () => {
    stub([CAMPAIGN]);
    page();
    expect(await screen.findByRole("region", { name: "Grupos este mes" })).toHaveTextContent("$ 3.912.000 COP");
    const card = screen.getByRole("button", { name: "Abrir Lanzamiento Navidad" });
    expect(card).toHaveTextContent("Llenando");
    expect(card).toHaveTextContent("360 cupos en #2");
  });

  it("una campaña: enlace con QR, del clic a la venta y los grupos", async () => {
    stub([CAMPAIGN]);
    page(`/groups?campaign=${ID}`);
    expect(await screen.findByRole("region", { name: "Enlace único" })).toHaveTextContent("app.test/g/navidad");
    expect(screen.getByRole("region", { name: "Del clic a la venta" })).toHaveTextContent("$ 3.912.000 COP");
    expect(screen.getByRole("region", { name: "Los grupos" })).toHaveTextContent("Se crea solo");
    expect(await screen.findByRole("img", { name: /Código QR/ })).toBeInTheDocument();
  });

  it("crear una campaña: el enlace sale del nombre", async () => {
    stub([]);
    page("/groups?view=new");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre de la campaña" }), "Promo Día Mamá");
    expect(screen.getByRole("textbox", { name: "Enlace" })).toHaveValue("promo-dia-mama");
    await waitFor(() => expect(screen.getByRole("button", { name: /Ventas 1/ })).toHaveAttribute("aria-pressed", "true"));
    await userEvent.click(screen.getByRole("button", { name: "Crear campaña" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/groups/campaigns")?.body).toMatchObject({ name: "Promo Día Mamá", slug: "promo-dia-mama", connectionIds: ["c1"], capacity: 1000 }));
  });

  it("enviar a los grupos de una campaña, avisando a todos", async () => {
    stub([CAMPAIGN]);
    page(`/groups?view=send&to=${ID}`);
    await screen.findByRole("button", { name: /Campaña Lanzamiento Navidad/ });
    await userEvent.type(screen.getByRole("textbox", { name: "Mensaje" }), "Abrimos cupos");
    await userEvent.click(await screen.findByRole("button", { name: "Enviar a 1 grupo" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/groups/posts")?.body).toMatchObject({ campaignIds: [ID], mentionAll: true, content: { kind: "text", text: "Abrimos cupos" } }));
  });
});
