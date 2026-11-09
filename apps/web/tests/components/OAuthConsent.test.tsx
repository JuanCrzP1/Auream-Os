import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OAuthConsentPage } from "../../src/features/integrations/pages/OAuthConsentPage";

// ---------------------------------------------------------------------------
// `/oauth/authorize`: Claude (web o escritorio) pide acceso; el usuario ve qué
// agente es y a dónde vuelve, elige la cuenta y los permisos, y autoriza o
// cancela: en ambos casos el navegador vuelve al agente.
// ---------------------------------------------------------------------------

const tenants = vi.hoisted(() => ({
  value: {
    state: { status: "ready", tenants: [{ tenantId: "t1", tenantKey: "a", tenantName: "Tienda Laura", role: "owner" }] },
    activeTenantId: "t1" as string | null,
    selectTenant: vi.fn()
  }
}));
vi.mock("@shared/auth/tenant/ActiveTenantContext", () => ({ useActiveTenant: () => tenants.value }));

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const QUERY = "?response_type=code&client_id=c1&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&code_challenge=x&code_challenge_method=S256&state=s1";

function stubApi(describe: { status: number; body: unknown }) {
  const decisions: Array<Record<string, unknown>> = [];
  const requested: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    if (url.pathname === "/oauth/authorize/request") {
      requested.push(url.search);
      return reply(describe.status, describe.body);
    }
    if (url.pathname === "/oauth/authorize/decision") {
      const body = JSON.parse(String(init!.body)) as Record<string, unknown>;
      decisions.push(body);
      return reply(200, { redirectTo: body["approve"] ? "https://claude.ai/api/mcp/auth_callback?code=abc&state=s1" : "https://claude.ai/api/mcp/auth_callback?error=access_denied&state=s1" });
    }
    return reply(404, { message: "no" });
  }));
  return { decisions, requested };
}

function renderPage(navigate = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[`/oauth/authorize${QUERY}`]}>
      <Routes>
        <Route path="/oauth/authorize" element={<OAuthConsentPage navigate={navigate} />} />
      </Routes>
    </MemoryRouter>
  );
  return navigate;
}

const READY = { status: 200, body: { status: "ready", clientName: "Claude", redirectHost: "claude.ai" } };

beforeEach(() => {
  vi.restoreAllMocks();
  tenants.value.activeTenantId = "t1";
});

describe("autorizar un agente (OAuth)", () => {
  it("muestra el agente, la cuenta y a dónde vuelve; autorizar manda los permisos elegidos y vuelve con el código", async () => {
    const api = stubApi(READY);
    const navigate = renderPage();
    expect(await screen.findByRole("heading", { name: "«Claude» quiere conectarse a tu cuenta de Auream" })).toBeInTheDocument();
    expect(api.requested[0]).toContain("client_id=c1");
    expect(screen.getByText("Tienda Laura")).toBeInTheDocument();
    expect(screen.getByText("claude.ai")).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Conversaciones" })).getByRole("radio", { name: "Ver y editar" }));
    await userEvent.click(screen.getByRole("button", { name: "Autorizar" }));
    expect(api.decisions[0]).toMatchObject({ approve: true, params: { client_id: "c1", state: "s1" }, permissions: { flows: "read", contacts: "read", conversations: "write" } });
    expect(navigate).toHaveBeenCalledWith("https://claude.ai/api/mcp/auth_callback?code=abc&state=s1");
  });

  it("cancelar vuelve al agente con el rechazo; sin ningún permiso no se puede autorizar", async () => {
    const api = stubApi(READY);
    const navigate = renderPage();
    await screen.findByRole("button", { name: "Autorizar" });
    for (const area of ["Flujos", "Contactos y etiquetas"]) await userEvent.click(within(screen.getByRole("radiogroup", { name: area })).getByRole("radio", { name: "Sin acceso" }));
    expect(screen.getByRole("button", { name: "Autorizar" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(api.decisions[0]).toEqual({ approve: false, params: expect.objectContaining({ client_id: "c1" }) });
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining("error=access_denied"));
  });

  it("una solicitud inválida lo explica y, si se puede, ofrece volver al agente", async () => {
    stubApi({ status: 200, body: { status: "invalid", message: "Falta PKCE (code_challenge con S256).", redirectTo: "https://claude.ai/cb?error=invalid_request" } });
    renderPage();
    expect(await screen.findByText("Falta PKCE (code_challenge con S256).")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al agente" })).toHaveAttribute("href", "https://claude.ai/cb?error=invalid_request");
  });

  it("sin permiso para conectar agentes (403) lo dice", async () => {
    stubApi({ status: 403, body: { message: "Access denied" } });
    renderPage();
    expect(await screen.findByText("No puedes autorizar agentes en esta cuenta")).toBeInTheDocument();
  });

  it("con varias cuentas y ninguna elegida, pide elegir la cuenta antes de nada", async () => {
    const api = stubApi(READY);
    tenants.value.activeTenantId = null;
    tenants.value.state = { status: "ready", tenants: [...tenants.value.state.tenants, { tenantId: "t2", tenantKey: "b", tenantName: "Otra", role: "owner" }] };
    renderPage();
    expect(screen.getByRole("heading", { name: "¿En qué cuenta conectas el agente?" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Cuenta" }), "t2");
    expect(tenants.value.selectTenant).toHaveBeenCalledWith("t2");
    expect(api.requested).toEqual([]);
  });
});
