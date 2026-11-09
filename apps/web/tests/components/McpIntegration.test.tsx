import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { IntegrationDetailPage } from "../../src/features/integrations/pages/IntegrationDetailPage";
import type { McpCredentialSummary } from "@contracts/McpContracts";

// ---------------------------------------------------------------------------
// Integraciones → Agentes de IA (MCP): la dirección del servidor y cómo
// conectar cada agente; crear una credencial con permisos por área (el token
// se ve una sola vez, con la configuración lista); revocarla.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const URL_MCP = "https://auream-os.vercel.app/api/mcp";

function stubApi() {
  let credentials: McpCredentialSummary[] = [];
  const posts: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/mcp-credentials" && method === "GET") return reply(200, { server: { url: URL_MCP }, credentials });
    if (url.pathname === "/mcp-credentials" && method === "POST") {
      const body = JSON.parse(String(init!.body));
      posts.push(body);
      const credential: McpCredentialSummary = { id: "k1", name: body.name, permissions: body.permissions, hint: "••••9xyz", createdAt: "2026-11-09T19:00:00.000Z", lastUsedAt: null, expiresAt: null };
      credentials = [credential];
      return reply(201, { credential, token: "aur_mcp_secreto9xyz" });
    }
    if (url.pathname === "/mcp-credentials/k1" && method === "DELETE") {
      credentials = [];
      return reply(204);
    }
    return reply(404, { message: "no" });
  }));
  return { posts };
}

const renderPanel = () =>
  render(
    <MemoryRouter initialEntries={["/integrations/mcp"]}>
      <Routes>
        <Route path="/integrations/:integrationId" element={<IntegrationDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("agentes de IA (MCP)", () => {
  it("muestra la dirección del servidor y cómo conectar Claude Code, Cursor o n8n", async () => {
    stubApi();
    renderPanel();
    expect(await screen.findByRole("textbox", { name: "Dirección del servidor MCP" })).toHaveValue(URL_MCP);
    expect(screen.getByText(`claude mcp add --transport http auream ${URL_MCP} --header "Authorization: Bearer <tu-token>"`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "n8n" }));
    expect(screen.getByText(/Encabezado: Authorization/)).toBeInTheDocument();
  });

  it("crea una credencial con permisos por área y muestra el token una sola vez, con la configuración lista", async () => {
    const api = stubApi();
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Nueva credencial" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva credencial" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Claude de ventas");
    await userEvent.click(within(within(dialog).getByRole("radiogroup", { name: "Contactos y etiquetas" })).getByRole("radio", { name: "Ver y editar" }));
    await userEvent.click(within(within(dialog).getByRole("radiogroup", { name: "Flujos" })).getByRole("radio", { name: "Sin acceso" }));
    expect(within(within(dialog).getByRole("radiogroup", { name: "Números de WhatsApp" })).queryByRole("radio", { name: "Ver y editar" })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear credencial" }));

    expect(api.posts[0]).toEqual({ name: "Claude de ventas", permissions: { flows: "none", contacts: "write" }, expiresInDays: 90 });
    const token = await screen.findByRole("dialog", { name: "Credencial «Claude de ventas» creada" });
    expect(within(token).getByRole("textbox", { name: "Token de la credencial" })).toHaveValue("aur_mcp_secreto9xyz");
    expect(within(token).getByText(/Bearer aur_mcp_secreto9xyz/)).toBeInTheDocument();
    await userEvent.click(within(token).getByRole("button", { name: "Ya lo guardé" }));

    const card = screen.getByRole("article", { name: "Claude de ventas" });
    expect(within(card).getByText("Contactos y etiquetas: ver y editar")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("aur_mcp_secreto9xyz");
  });

  it("revocar pide confirmación y la quita", async () => {
    stubApi();
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Nueva credencial" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva credencial" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "n8n");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear credencial" }));
    await userEvent.click(await screen.findByRole("button", { name: "Ya lo guardé" }));

    await userEvent.click(within(screen.getByRole("article", { name: "n8n" })).getByRole("button", { name: "Revocar" }));
    await userEvent.click(within(screen.getByRole("alertdialog", { name: "¿Revocar «n8n»?" })).getByRole("button", { name: "Revocar credencial" }));
    expect(await screen.findByText("Crea la credencial de tu primer agente")).toBeInTheDocument();
  });
});
