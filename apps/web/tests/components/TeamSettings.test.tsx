import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { TeamResponse } from "@contracts/TeamContracts";
import { TeamSettings } from "../../src/features/team/components/TeamSettings";

// ---------------------------------------------------------------------------
// Configuración → Equipo: miembros con su rol, invitaciones pendientes, y lo
// que cada quien puede hacer. Quien administra invita (con enlace para copiar
// o mandar por WhatsApp), cambia roles y quita; los demás solo ven.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const OWNER_VIEW: TeamResponse = {
  myRole: "tenant_owner",
  assignableRoles: ["tenant_owner", "tenant_admin", "operator", "viewer"],
  members: [
    { userId: "u1", displayName: "Camilo", email: "camilo@x.co", photoUrl: null, role: "tenant_owner", joinedAt: "2026-11-01T00:00:00.000Z", isYou: true, canManage: false },
    { userId: "u2", displayName: "Ana", email: "ana@x.co", photoUrl: null, role: "operator", joinedAt: "2026-11-03T00:00:00.000Z", isYou: false, canManage: true }
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

const TOKEN = "t".repeat(43);
let calls: Array<{ method: string; path: string; body: unknown }> = [];

function stubApi(view: TeamResponse) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/team" && method === "GET") return reply(200, view);
    if (url.pathname === "/team/invitations" && method === "POST") {
      return reply(201, { invitation: { id: "i2", email: "pedro@x.co", role: "operator", invitedByName: "Camilo", createdAt: "x", expiresAt: "2099-01-01T00:00:00.000Z", expired: false, canManage: true }, token: TOKEN });
    }
    if (url.pathname.startsWith("/team/members/") && method === "PATCH") return reply(200, view);
    if (method === "DELETE") return reply(204);
    return reply(404, { message: "no" });
  }));
}

const renderTeam = () =>
  render(
    <MemoryRouter>
      <TeamSettings />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Equipo — quien lo administra", () => {
  it("muestra miembros con su rol, quién eres y las invitaciones pendientes", async () => {
    stubApi(OWNER_VIEW);
    renderTeam();
    expect(await screen.findByText("Camilo")).toBeInTheDocument();
    expect(screen.getByText("Tú")).toBeInTheDocument();
    expect(screen.getByText("maria@x.co")).toBeInTheDocument();
    expect(screen.getByText("miembros").parentElement).toHaveTextContent("2 miembros");
    expect(screen.getByText("invitación pendiente").parentElement).toHaveTextContent("1 invitación pendiente");
    // A sí mismo no se toca; a Ana sí.
    expect(screen.queryByRole("combobox", { name: "Rol de Camilo" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Rol de Ana" })).toHaveValue("operator");
  });

  it("invitar crea el enlace para copiar o mandar por WhatsApp", async () => {
    stubApi(OWNER_VIEW);
    renderTeam();
    await userEvent.click(await screen.findByRole("button", { name: /Invitar/ }));
    const dialog = screen.getByRole("dialog", { name: "Invitar a tu equipo" });
    expect(within(dialog).getByRole("radio", { name: /Asesor/ })).toBeChecked();

    await userEvent.type(within(dialog).getByLabelText("Correo de la persona"), "pedro@x.co");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear invitación" }));

    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ email: "pedro@x.co", role: "operator" });
    expect(await screen.findByRole("heading", { name: "Invitación lista" })).toBeInTheDocument();
    expect(screen.getByLabelText("Enlace de la invitación")).toHaveValue(`${window.location.origin}/invite/${TOKEN}`);
    expect(screen.getByRole("link", { name: /Enviar por WhatsApp/ }).getAttribute("href")).toContain(encodeURIComponent(`/invite/${TOKEN}`));
  });

  it("cambiar el rol y quitar a alguien llaman a la API de su cuenta", async () => {
    stubApi(OWNER_VIEW);
    renderTeam();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Rol de Ana" }), "viewer");
    expect(calls.find((call) => call.method === "PATCH")).toMatchObject({ path: "/team/members/u2", body: { role: "viewer" } });

    await userEvent.click(screen.getByRole("button", { name: "Quitar a Ana del equipo" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Quitar del equipo" }));
    expect(calls.some((call) => call.method === "DELETE" && call.path === "/team/members/u2")).toBe(true);
  });
});

describe("Equipo — quien solo lo ve", () => {
  it("sin Invitar, sin cambiar roles ni quitar; ve la guía de roles", async () => {
    stubApi(VIEWER_VIEW);
    renderTeam();
    expect(await screen.findByText("Camilo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Invitar/ })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Quitar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enlace nuevo" })).toBeNull();
    expect(screen.getByText("¿Qué puede hacer cada rol?")).toBeInTheDocument();
  });
});
