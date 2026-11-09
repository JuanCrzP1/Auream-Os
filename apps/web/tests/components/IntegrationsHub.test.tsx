import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { IntegrationsPage } from "../../src/features/integrations/pages/IntegrationsPage";
import { IntegrationDetailPage } from "../../src/features/integrations/pages/IntegrationDetailPage";

// ---------------------------------------------------------------------------
// Centro de Integraciones: catálogo por categorías, buscador, «Activas» con
// lo conectado y «Disponibles»; cada tarjeta lleva a la página de su
// integración, con su panel (p. ej. OpenAI con su diálogo ya elegido).
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

function stubApi() {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(String(input), "http://api.test");
    if (url.pathname === "/ai-credentials") {
      return reply(200, { credentials: [{ id: "c1", provider: "openai", name: "OpenAI principal", hint: "••••abcd", status: "active", lastVerifiedAt: null, createdAt: "x" }] });
    }
    if (url.pathname === "/pixel-connections") return reply(200, { connections: [] });
    if (url.pathname === "/inbound-webhooks") return reply(200, { webhooks: [] });
    return reply(404, { message: "no" });
  }));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/integrations/:integrationId" element={<IntegrationDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const group = (name: RegExp) => screen.getByRole("region", { name });
const cardNames = (region: HTMLElement) => within(region).queryAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

beforeEach(() => {
  vi.restoreAllMocks();
  stubApi();
});

describe("centro de Integraciones", () => {
  it("muestra arriba lo conectado y debajo lo disponible, con su estado", async () => {
    renderAt("/integrations");
    const active = await screen.findByRole("region", { name: /Activas/ });
    expect(cardNames(active)).toEqual(["OpenAI"]);
    expect(within(active).getByText("1 conexión")).toBeInTheDocument();
    expect(cardNames(group(/Disponibles/))).toEqual(["Google Gemini", "OpenRouter", "Píxel de Meta", "Webhooks de entrada"]);
  });

  it("filtra por categoría y por búsqueda", async () => {
    renderAt("/integrations");
    await screen.findByRole("region", { name: /Activas/ });
    await userEvent.click(screen.getByRole("tab", { name: "Seguimiento" }));
    expect(screen.queryByRole("region", { name: /Activas/ })).not.toBeInTheDocument();
    expect(cardNames(group(/Disponibles/))).toEqual(["Píxel de Meta"]);

    await userEvent.click(screen.getByRole("tab", { name: "Todas" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar integración" }), "claude");
    expect(cardNames(group(/Disponibles/))).toEqual(["OpenRouter"]);
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar integración" }), "xyz");
    expect(screen.getByText("Ninguna integración coincide")).toBeInTheDocument();
  });

  it("cada tarjeta lleva a su página: OpenAI con sus conexiones y su diálogo ya elegido", async () => {
    renderAt("/integrations");
    await userEvent.click(await screen.findByRole("link", { name: "Administrar OpenAI" }));
    expect(screen.getByRole("heading", { level: 1, name: "OpenAI" })).toBeInTheDocument();
    expect(await screen.findByRole("article", { name: "OpenAI principal" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Conectar OpenAI" }));
    const dialog = screen.getByRole("dialog", { name: "Conectar OpenAI" });
    expect(within(dialog).queryByRole("radiogroup", { name: "Proveedor" })).not.toBeInTheDocument();
  });

  it("una integración que no existe lo dice y ofrece volver", async () => {
    renderAt("/integrations/no-existe");
    expect(screen.getByText("Esta integración no existe")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver integraciones" })).toHaveAttribute("href", "/integrations");
  });
});
