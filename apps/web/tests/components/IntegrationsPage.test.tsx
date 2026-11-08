import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntegrationsPage } from "../../src/features/integrations/pages/IntegrationsPage";
import type { AiCredentialSummary } from "@contracts/AiContracts";

// ---------------------------------------------------------------------------
// Integraciones → Inteligencia artificial: conectar, ver (sin la clave),
// verificar, cambiar clave, renombrar y eliminar. API falsa con estado.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

function stubApi(seed: AiCredentialSummary[] = [], options: { listStatus?: number } = {}) {
  let items = [...seed];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};
    if (url.pathname === "/ai-credentials" && method === "GET") {
      return options.listStatus ? reply(options.listStatus, { message: "x" }) : reply(200, { credentials: items });
    }
    if (url.pathname === "/ai-credentials" && method === "POST") {
      if (!body["apiKey"]!.includes("valida")) return reply(422, { message: "OpenAI rechazó la clave. Revisa que esté completa y activa." });
      const created: AiCredentialSummary = { id: `c${items.length + 1}`, provider: body["provider"] as "openai", name: body["name"]!, hint: `••••${body["apiKey"]!.slice(-4)}`, status: "active", lastVerifiedAt: "2026-11-08T16:00:00.000Z", createdAt: "x" };
      items.push(created);
      return reply(201, created);
    }
    const verify = /^\/ai-credentials\/([^/]+)\/verify$/.exec(url.pathname);
    if (verify) {
      items = items.map((c) => (c.id === verify[1] ? { ...c, status: "invalid" } : c));
      return reply(200, items.find((c) => c.id === verify[1]));
    }
    const one = /^\/ai-credentials\/([^/]+)$/.exec(url.pathname);
    if (one && method === "PATCH") {
      items = items.map((c) => (c.id === one[1] ? { ...c, ...(body["name"] ? { name: body["name"] } : {}), ...(body["apiKey"] ? { hint: `••••${body["apiKey"].slice(-4)}`, status: "active" as const } : {}) } : c));
      return reply(200, items.find((c) => c.id === one[1]));
    }
    if (one && method === "DELETE") {
      items = items.filter((c) => c.id !== one[1]);
      return reply(204);
    }
    return reply(404, { message: "no" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, items: () => items };
}

const OPENAI: AiCredentialSummary = { id: "c1", provider: "openai", name: "OpenAI principal", hint: "••••abcd", status: "active", lastVerifiedAt: "2026-11-08T16:00:00.000Z", createdAt: "x" };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("conectar", () => {
  it("sin conexiones invita a conectar; al conectar aparece la tarjeta con solo la pista de la clave", async () => {
    const api = stubApi();
    render(<IntegrationsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Conectar IA" }));
    const dialog = screen.getByRole("dialog", { name: "Conectar una IA" });
    await userEvent.click(within(dialog).getByRole("radio", { name: /Google Gemini/ }));
    await userEvent.type(within(dialog).getByLabelText("Clave de API"), "AIza-clave-valida-0123456789wxyz");
    await userEvent.click(within(dialog).getByRole("button", { name: "Conectar" }));

    const card = await screen.findByRole("article", { name: "Google Gemini" });
    expect(within(card).getByText("••••wxyz")).toBeInTheDocument();
    expect(within(card).getByText("Activa")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("AIza-clave-valida");
    expect(api.items()[0]).toMatchObject({ provider: "gemini", name: "Google Gemini" });
  });

  it("si el proveedor rechaza la clave lo explica y no cierra el diálogo", async () => {
    stubApi();
    render(<IntegrationsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Conectar IA" }));
    const dialog = screen.getByRole("dialog", { name: "Conectar una IA" });
    await userEvent.type(within(dialog).getByLabelText("Clave de API"), "sk-incorrecta-0123456789abcdef");
    await userEvent.click(within(dialog).getByRole("button", { name: "Conectar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("OpenAI rechazó la clave");
  });
});

describe("administrar", () => {
  it("verificar muestra si el proveedor ya no acepta la clave; cambiarla la reactiva", async () => {
    stubApi([OPENAI]);
    render(<IntegrationsPage />);
    const card = await screen.findByRole("article", { name: "OpenAI principal" });

    await userEvent.click(within(card).getByRole("button", { name: "Verificar" }));
    expect(await within(await screen.findByRole("article", { name: "OpenAI principal" })).findByText("Clave rechazada")).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole("article", { name: "OpenAI principal" })).getByRole("button", { name: "Cambiar clave" }));
    await userEvent.type(screen.getByLabelText("Nueva clave de OpenAI"), "sk-nueva-valida-0123456789zz99");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    const updated = await screen.findByRole("article", { name: "OpenAI principal" });
    expect(await within(updated).findByText("••••zz99")).toBeInTheDocument();
    expect(within(updated).getByText("Activa")).toBeInTheDocument();
  });

  it("renombrar y eliminar (con confirmación)", async () => {
    const api = stubApi([OPENAI]);
    render(<IntegrationsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Renombrar OpenAI principal" }));
    const name = screen.getByLabelText("Nombre");
    await userEvent.clear(name);
    await userEvent.type(name, "Ventas");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("article", { name: "Ventas" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar Ventas" }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar conexión" }));
    expect(await screen.findByText("Conecta tu primera IA")).toBeInTheDocument();
    expect(api.items()).toEqual([]);
  });
});

describe("estados", () => {
  it.each([
    [503, "Conexiones de IA no disponibles"],
    [403, "Sin acceso a las conexiones"],
    [500, "No pudimos cargar tus conexiones"]
  ])("HTTP %i → %s", async (status, title) => {
    stubApi([], { listStatus: status });
    render(<IntegrationsPage />);
    expect(await screen.findByText(title)).toBeInTheDocument();
  });
});
