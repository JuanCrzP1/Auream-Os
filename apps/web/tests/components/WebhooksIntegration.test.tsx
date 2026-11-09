import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { IntegrationDetailPage } from "../../src/features/integrations/pages/IntegrationDetailPage";
import { IntegrationItemPage } from "../../src/features/integrations/pages/IntegrationItemPage";
import { EMPTY_WEBHOOK_MAPPING, type WebhookDetail } from "@contracts/WebhookContracts";

// ---------------------------------------------------------------------------
// Integraciones → Webhooks de entrada: crear (y pasar a configurarlo), mapear
// con clic en el árbol del envío de ejemplo, guardar y ver el historial.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const DETAIL: WebhookDetail = {
  id: "w1",
  name: "Ventas Hotmart",
  enabled: true,
  connectionId: null,
  receivedThisMonth: 2,
  lastReceivedAt: "2026-11-09T18:00:00.000Z",
  createdAt: "2026-11-09T17:00:00.000Z",
  url: "https://auream-os.vercel.app/api/hooks/in/w1/secreto",
  mapping: EMPTY_WEBHOOK_MAPPING,
  sample: { data: { buyer: { name: "Laura", phone: "+58 412 555 0117" } } },
  sampleReceivedAt: "2026-11-09T18:00:00.000Z"
};

function stubApi() {
  const patches: unknown[] = [];
  let detail = DETAIL;
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/inbound-webhooks" && method === "GET") return reply(200, { webhooks: [] });
    if (url.pathname === "/inbound-webhooks" && method === "POST") return reply(201, { ...DETAIL, name: JSON.parse(String(init!.body)).name });
    if (url.pathname === "/inbound-webhooks/w1" && method === "PATCH") {
      const body = JSON.parse(String(init!.body));
      patches.push(body);
      detail = { ...detail, ...body };
      return reply(200, detail);
    }
    if (url.pathname === "/inbound-webhooks/w1") return reply(200, detail);
    if (url.pathname === "/inbound-webhooks/w1/deliveries") {
      return reply(200, { deliveries: [{ id: "d1", receivedAt: "2026-11-09T18:00:00.000Z", outcome: "failed", phone: null, contactId: null, flowStarted: false, notes: [], error: "No llegó un teléfono válido en «data.x».", payload: { a: 1 } }] });
    }
    if (url.pathname === "/connections") return reply(200, { connections: [] });
    if (url.pathname === "/labels") return reply(200, { labels: [] });
    if (url.pathname === "/automations") return reply(200, { flows: [], folders: [] });
    return reply(404, { message: "no" });
  }));
  return { patches };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/integrations/:integrationId" element={<IntegrationDetailPage />} />
        <Route path="/integrations/:integrationId/:itemId" element={<IntegrationItemPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("webhooks de entrada", () => {
  it("sin webhooks invita a crear uno; al crearlo lleva a configurarlo", async () => {
    stubApi();
    renderAt("/integrations/webhooks");
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo webhook" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo webhook" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Ventas Hotmart");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear y configurar" }));
    expect(await screen.findByRole("textbox", { name: "Dirección del webhook" })).toHaveValue(DETAIL.url);
  });

  it("mapea con clic en el árbol del ejemplo (al campo elegido) y guarda", async () => {
    const api = stubApi();
    renderAt("/integrations/webhooks/w1");
    // Sin campo elegido, el primer clic va al teléfono.
    await userEvent.click(await screen.findByRole("button", { name: /phone/ }));
    expect(screen.getByRole("textbox", { name: "Teléfono (obligatorio)" })).toHaveValue("data.buyer.phone");
    await userEvent.click(screen.getByRole("textbox", { name: "Nombre" }));
    await userEvent.click(screen.getByRole("button", { name: /name/ }));
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("data.buyer.name");

    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Cambios guardados.")).toBeInTheDocument();
    expect(api.patches[0]).toMatchObject({ mapping: { phonePath: "data.buyer.phone", namePath: "data.buyer.name" } });
  });

  it("el historial muestra cada envío con lo que pasó", async () => {
    stubApi();
    renderAt("/integrations/webhooks/w1");
    await userEvent.click(await screen.findByRole("tab", { name: "Historial" }));
    expect(await screen.findByText("No llegó un teléfono válido en «data.x».")).toBeInTheDocument();
    expect(screen.getByText("Falló")).toBeInTheDocument();
  });

  it("un webhook que no existe lo dice y ofrece volver", async () => {
    stubApi();
    renderAt("/integrations/webhooks/no-existe");
    expect(await screen.findByText("Este webhook no existe")).toBeInTheDocument();
  });
});
