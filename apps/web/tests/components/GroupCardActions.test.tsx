import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { CampaignDetailResponse, CampaignSummary, GroupSummary } from "@contracts/GroupContracts";
import { GroupsPage } from "../../src/features/groups/pages/GroupsPage";

// ---------------------------------------------------------------------------
// Cada grupo de una campaña tiene su menú «⋯»: copiar su enlace, enviar solo
// a ese grupo o sacarlo de la campaña (con confirmación). Y el cupo se escribe
// libre: se ajusta al límite solo al salir del campo.
// ---------------------------------------------------------------------------

vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,AAA" } }));

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const STATS = { clicks: 10, joined: 3, left: 1, members: 2, buyers: 0, revenue: [] };
const CAMPAIGN: CampaignSummary = {
  id: ID, name: "Prueba grupos", slug: "prueba", link: "https://app.test/g/prueba", status: "active", connections: [{ id: "c1", name: "flujo 1" }], capacity: 20,
  template: { namePattern: "VIP", description: "", imageUrl: null, announce: true, locked: true },
  rules: { welcome: { enabled: true, text: "¡Bienvenidos {nombres}!", everyMinutes: 15 }, labelOnJoin: true },
  groups: [{ id: "g1", name: "VIP #1", members: 2, state: "open", position: 1 }],
  current: { groupId: "g1", name: "VIP #1", free: 18 }, stats: STATS, createdAt: "2026-11-13T00:00:00.000Z"
};
const GROUP: GroupSummary = {
  id: "g1", connectionId: "c1", connectionName: "flujo 1", name: "VIP #1", description: "", imageUrl: null, campaignId: ID, campaignName: "Prueba grupos", position: 1,
  state: "open", isAdmin: true, announce: true, locked: true, inviteLink: "https://chat.whatsapp.com/abc", syncedAt: null, members: 2, joined: 3, left: 1, buyers: 0, revenue: []
};
const DETAIL: CampaignDetailResponse = { campaign: CAMPAIGN, groups: [GROUP], posts: [], daily: [], canManage: true };

let calls: Array<{ method: string; path: string; body: unknown }> = [];
function stub() {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/groups") return reply(200, { campaigns: [CAMPAIGN], month: STATS, canManage: true, hasNumbers: true });
    if (url.pathname === "/groups/list") return reply(200, { groups: [GROUP], syncedAt: null, canManage: true });
    if (url.pathname === "/groups/list/g1" && method === "PATCH") return reply(200, { groups: [{ ...GROUP, campaignId: null }], syncedAt: null, canManage: true });
    if (url.pathname === `/groups/campaigns/${ID}`) return reply(200, DETAIL);
    if (url.pathname === "/groups/posts") return reply(201, {});
    if (url.pathname === "/connections") return reply(200, { connections: [{ id: "c1", name: "flujo 1", method: "qr", status: "connected" }] });
    return reply(404, {});
  }));
}
const page = (path: string) => render(<MemoryRouter initialEntries={[path]}><GroupsPage /></MemoryRouter>);
const openMenu = async () => userEvent.click(await screen.findByRole("button", { name: "Más acciones de VIP #1" }));

beforeEach(() => vi.restoreAllMocks());

describe("Acciones de cada grupo", () => {
  it("copia el enlace de ese grupo", async () => {
    stub();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    page(`/groups?campaign=${ID}`);
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Copiar el enlace de este grupo" }));
    expect(writeText).toHaveBeenCalledWith("https://chat.whatsapp.com/abc");
    expect(await screen.findByRole("status")).toHaveTextContent("Enlace del grupo copiado");
  });

  it("envía solo a ese grupo, no a toda la campaña", async () => {
    stub();
    page(`/groups?campaign=${ID}`);
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Enviar solo a este grupo" }));
    await userEvent.type(await screen.findByPlaceholderText(/Abrimos los cupos/), "Hola grupo");
    await userEvent.click(await screen.findByRole("button", { name: "Enviar a 1 grupo" }));
    const post = calls.find((call) => call.path === "/groups/posts" && call.method === "POST");
    expect(post?.body).toMatchObject({ campaignIds: [], groupIds: ["g1"] });
  });

  it("sacar de la campaña pide confirmación y luego lo saca", async () => {
    stub();
    page(`/groups?campaign=${ID}`);
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Sacar de la campaña" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Sacar «VIP #1» de la campaña?");
    expect(calls.some((call) => call.method === "PATCH")).toBe(false);
    await userEvent.click(within(dialog).getByRole("button", { name: "Sacar de la campaña" }));
    expect(calls.find((call) => call.method === "PATCH")).toMatchObject({ path: "/groups/list/g1", body: { campaignId: null } });
  });
});

describe("El cupo por grupo", () => {
  it("se escribe libre y se ajusta al límite solo al salir del campo", async () => {
    stub();
    page("/groups?view=new");
    const cupo = await screen.findByRole("textbox", { name: /Cupo por grupo/ });
    await userEvent.clear(cupo);
    await userEvent.type(cupo, "50");
    expect(cupo).toHaveValue("50");
    await userEvent.tab();
    expect(screen.getByRole("textbox", { name: /Cupo por grupo/ })).toHaveValue("50");

    const again = screen.getByRole("textbox", { name: /Cupo por grupo/ });
    await userEvent.clear(again);
    await userEvent.type(again, "5");
    expect(again).toHaveValue("5");
    await userEvent.tab();
    expect(screen.getByRole("textbox", { name: /Cupo por grupo/ })).toHaveValue("20");
  });
});
