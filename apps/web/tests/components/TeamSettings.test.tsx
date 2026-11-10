import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { TeamResponse } from "@contracts/TeamContracts";
import { TeamSettings } from "../../src/features/team/components/TeamSettings";

// ---------------------------------------------------------------------------
// Configuración → Equipo, por pestañas: Miembros (buscador, filtro, menú ⋯),
// Invitaciones, Roles y Actividad. Quien administra invita (a uno o a varios,
// con enlace para copiar o mandar por WhatsApp), cambia roles y quita; los
// demás solo ven.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const OWNER_VIEW: TeamResponse = {
  myRole: "tenant_owner",
  assignableRoles: ["tenant_owner", "tenant_admin", "operator", "viewer"],
  members: [
    { userId: "u1", displayName: "Camilo", email: "camilo@x.co", photoUrl: null, role: "tenant_owner", joinedAt: "2026-11-01T00:00:00.000Z", lastSeenAt: null, isYou: true, canManage: false },
    { userId: "u2", displayName: "Ana", email: "ana@x.co", photoUrl: null, role: "operator", joinedAt: "2026-11-03T00:00:00.000Z", lastSeenAt: null, isYou: false, canManage: true }
  ],
  invitations: [
    { id: "i1", email: "maria@x.co", role: "viewer", invitedByName: "Camilo", createdAt: "2026-11-10T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z", expired: false, canManage: true }
  ]
};

const VIEWER_VIEW: TeamResponse = {
  ...OWNER_VIEW,
  myRole: "viewer",
  assignableRoles: [],
  members: OWNER_VIEW.members.map((member) => ({ ...member, isYou: member.userId === "u2", canManage: false })),
  invitations: OWNER_VIEW.invitations.map((invitation) => ({ ...invitation, canManage: false }))
};

const ALONE_VIEW: TeamResponse = { ...OWNER_VIEW, members: [OWNER_VIEW.members[0]!], invitations: [] };

const ACTIVITY = [
  { id: "a1", action: "role_changed", actorName: "Camilo", targetName: "Ana", role: "viewer", at: "2026-11-10T15:00:00.000Z" },
  { id: "a2", action: "invited", actorName: "Camilo", targetName: "maria@x.co", role: "viewer", at: "2026-11-09T15:00:00.000Z" }
];

const TOKEN = "t".repeat(43);
let calls: Array<{ method: string; path: string; body: unknown }> = [];

function stubApi(view: TeamResponse) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/team" && method === "GET") return reply(200, view);
    if (url.pathname === "/team/activity" && method === "GET") return reply(200, { entries: ACTIVITY });
    if (url.pathname === "/team/invitations" && method === "POST") {
      const { email, role } = JSON.parse(String(init?.body)) as { email: string; role: string };
      if (email === "existe@x.co") return reply(409, { message: "Esa persona ya está en el equipo." });
      return reply(201, { invitation: { id: `inv-${email}`, email, role, invitedByName: "Camilo", createdAt: "x", expiresAt: "2099-01-01T00:00:00.000Z", expired: false, canManage: true }, token: TOKEN });
    }
    if (url.pathname.startsWith("/team/members/") && method === "PATCH") return reply(200, view);
    if (method === "DELETE") return reply(204);
    return reply(404, { message: "no" });
  }));
}

const renderTeam = (path = "/settings/team") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TeamSettings />
    </MemoryRouter>
  );

const tab = (name: RegExp) => screen.findByRole("tab", { name });

beforeEach(() => void vi.restoreAllMocks());

describe("Equipo — quien lo administra", () => {
  it("Miembros: la tabla con rol y quién eres; las pestañas cuentan miembros e invitaciones", async () => {
    stubApi(OWNER_VIEW);
    renderTeam();
    expect(await screen.findByText("Camilo")).toBeInTheDocument();
    expect(screen.getByText("Tú")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Miembros · 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Invitaciones · 1" })).toBeInTheDocument();
    // A sí mismo no se toca; a Ana sí.
    expect(screen.queryByRole("button", { name: "Acciones para Camilo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Acciones para Ana" })).toBeInTheDocument();
    // Ya no está solo: sin la tarjeta «Trabaja en equipo».
    expect(screen.queryByRole("heading", { name: "Trabaja en equipo" })).toBeNull();
  });

  it("el buscador (sin importar tildes) y el filtro por rol acotan la tabla", async () => {
    stubApi(OWNER_VIEW);
    renderTeam();
    await userEvent.type(await screen.findByRole("searchbox", { name: "Buscar persona" }), "ÁNA");
    const rows = () => within(screen.getByRole("list", { name: "Miembros" })).queryAllByRole("listitem");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Ana");

    await userEvent.clear(screen.getByRole("searchbox", { name: "Buscar persona" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filtrar por rol" }), "tenant_admin");
    expect(rows()).toHaveLength(0);
    expect(screen.getByText("Nadie coincide con la búsqueda.")).toBeInTheDocument();
  });

  it("el menú ⋯ cambia el rol y quita a alguien (con confirmación) en la API de su cuenta", async () => {
    stubApi(OWNER_VIEW);
    renderTeam();
    await userEvent.click(await screen.findByRole("button", { name: "Acciones para Ana" }));
    expect(screen.getByRole("menuitemradio", { name: /Asesor/ })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Solo lectura/ }));
    expect(calls.find((call) => call.method === "PATCH")).toMatchObject({ path: "/team/members/u2", body: { role: "viewer" } });
    expect(screen.queryByRole("menu")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Acciones para Ana" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Quitar del equipo" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Quitar del equipo" }));
    expect(calls.some((call) => call.method === "DELETE" && call.path === "/team/members/u2")).toBe(true);
  });

  it("invitar a una persona da su enlace para copiar o mandar por WhatsApp", async () => {
    stubApi(OWNER_VIEW);
    renderTeam();
    await userEvent.click(await screen.findByRole("button", { name: "Invitar personas" }));
    const dialog = screen.getByRole("dialog", { name: "Invitar personas" });
    expect(within(dialog).getByRole("radio", { name: /Asesor/ })).toBeChecked();

    await userEvent.type(within(dialog).getByLabelText("Correos (uno o varios)"), "Pedro@x.co{Enter}");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear invitación" }));

    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ email: "pedro@x.co", role: "operator" });
    expect(await screen.findByRole("heading", { name: "Invitación lista" })).toBeInTheDocument();
    expect(screen.getByLabelText("Enlace de la invitación")).toHaveValue(`${window.location.origin}/invite/${TOKEN}`);
    expect(screen.getByRole("link", { name: /Enviar por WhatsApp/ }).getAttribute("href")).toContain(encodeURIComponent(`/invite/${TOKEN}`));
  });

  it("invitar a varios: chips, avisa los que no son correo y da el resultado de cada uno", async () => {
    stubApi(OWNER_VIEW);
    renderTeam();
    await userEvent.click(await screen.findByRole("button", { name: "Invitar personas" }));
    const dialog = screen.getByRole("dialog", { name: "Invitar personas" });
    await userEvent.type(within(dialog).getByLabelText("Correos (uno o varios)"), "luis@x.co, existe@x.co malcorreo ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Invitar a 3" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Revisa este correo: malcorreo.");
    expect(calls.some((call) => call.method === "POST")).toBe(false);

    await userEvent.click(within(dialog).getByRole("button", { name: "Quitar malcorreo" }));
    expect(within(dialog).queryByRole("alert")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Invitar a 2" }));

    expect(await screen.findByRole("heading", { name: "1 de 2 invitaciones listas" })).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual([
      { email: "luis@x.co", role: "operator" },
      { email: "existe@x.co", role: "operator" }
    ]);
    expect(screen.getByRole("link", { name: "Enviar por WhatsApp a luis@x.co" })).toBeInTheDocument();
    expect(screen.getByText("Esa persona ya está en el equipo.")).toBeInTheDocument();
  });

  it("Invitaciones lista las pendientes con «Enlace nuevo» y retirar", async () => {
    stubApi(OWNER_VIEW);
    renderTeam();
    await userEvent.click(await tab(/Invitaciones/));
    expect(screen.getByText("maria@x.co")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enlace nuevo" })).toBeInTheDocument();
  });

  it("Actividad cuenta quién hizo qué, con el rol", async () => {
    stubApi(OWNER_VIEW);
    renderTeam("/settings/team?tab=activity");
    const list = await screen.findByRole("list", { name: "Actividad del equipo" });
    const items = within(list).getAllByRole("listitem").map((item) => item.querySelector("p")?.textContent);
    expect(items).toEqual(["Camilo cambió a Ana a Solo lectura", "Camilo invitó a maria@x.co como Solo lectura"]);
  });

  it("solo en la cuenta: la tarjeta «Trabaja en equipo» trae el único botón de invitar", async () => {
    stubApi(ALONE_VIEW);
    renderTeam();
    expect(await screen.findByRole("heading", { name: "Trabaja en equipo" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Invitar personas/ })).toHaveLength(1);
  });
});

describe("Equipo — quien solo lo ve", () => {
  it("sin invitar, sin menú ⋯ ni retirar; ve los roles en tarjetas", async () => {
    stubApi(VIEWER_VIEW);
    renderTeam();
    expect(await screen.findByText("Camilo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Invitar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Acciones para/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Trabaja en equipo" })).toBeNull();

    await userEvent.click(await tab(/Invitaciones/));
    expect(screen.queryByRole("button", { name: "Enlace nuevo" })).toBeNull();

    await userEvent.click(await tab(/Roles/));
    for (const role of ["Dueño", "Administrador", "Asesor", "Solo lectura"]) expect(screen.getByRole("article", { name: role })).toBeInTheDocument();
  });
});
