import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionsPage } from "../../src/features/connections/pages/ConnectionsPage";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { ConnectionTrigger } from "@contracts/ConnectionTriggerContracts";

// ---------------------------------------------------------------------------
// Disparadores desde la tarjeta del número: avisa si no tiene, se añaden por
// tipo (palabras clave como etiquetas), se pausan y se quitan; un genérico que
// ya existe no se ofrece. API falsa con estado.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const CONNECTION: ConnectionSummary = {
  id: "w1", name: "Ventas Colombia", method: "qr", status: "connected", phoneNumber: "573013815302", profileName: null,
  lastConnectedAt: "2026-11-01T15:00:00.000Z", triggerCount: 0, createdAt: "2026-11-01T15:00:00.000Z", updatedAt: "2026-11-01T15:00:00.000Z"
};
const FLOWS = [
  { id: "f1", key: "f1", name: "Ventas", status: "active", updatedAt: "x", nodeCount: 3, connectionStatus: "connected" },
  { id: "f2", key: "f2", name: "Soporte", status: "active", updatedAt: "x", nodeCount: 3, connectionStatus: "connected" },
  { id: "f3", key: "f3", name: "Viejo", status: "archived", updatedAt: "x", nodeCount: 3, connectionStatus: "connected" }
];

function stubApi() {
  let triggers: ConnectionTrigger[] = [];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (url.pathname === "/connections") return reply(200, { connections: [{ ...CONNECTION, triggerCount: triggers.length }] });
    if (url.pathname === "/automations") return reply(200, { flows: FLOWS, folders: [] });
    if (url.pathname === "/connections/w1/triggers" && method === "GET") return reply(200, { triggers });
    if (url.pathname === "/connections/w1/triggers" && method === "POST") {
      const flow = FLOWS.find((f) => f.id === body["automationId"])!;
      const created: ConnectionTrigger = {
        id: `t${triggers.length + 1}`, connectionId: "w1", type: body["type"] as ConnectionTrigger["type"], keywords: (body["keywords"] as string[]) ?? [],
        match: (body["match"] as ConnectionTrigger["match"]) ?? "contains", automationId: flow.id, automationName: flow.name, enabled: true, createdAt: `2026-11-09T00:00:0${triggers.length}.000Z`, updatedAt: "x"
      };
      triggers.push(created);
      return reply(201, created);
    }
    const one = /^\/connections\/w1\/triggers\/([^/]+)$/.exec(url.pathname);
    if (one && method === "PATCH") {
      triggers = triggers.map((t) => (t.id === one[1] ? { ...t, ...(body as Partial<ConnectionTrigger>) } : t));
      return reply(200, triggers.find((t) => t.id === one[1]));
    }
    if (one && method === "DELETE") {
      triggers = triggers.filter((t) => t.id !== one[1]);
      return reply(204);
    }
    return reply(404, { message: "no" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { triggers: () => triggers };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("disparadores de un número", () => {
  it("la tarjeta avisa si no tiene; se añaden por tipo, se pausan y se quitan", async () => {
    const api = stubApi();
    render(<ConnectionsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Disparadores de Ventas Colombia: ninguno" }));
    const dialog = await screen.findByRole("dialog", { name: "Disparadores" });
    expect(await within(dialog).findByText("Este número todavía no inicia ningún flujo")).toBeInTheDocument();

    // Palabra clave → Ventas
    await userEvent.click(within(dialog).getByRole("button", { name: "Añadir disparador" }));
    await userEvent.type(within(dialog).getByLabelText("Palabras clave"), "precio{Enter}cuánto cuesta{Enter}");
    await userEvent.selectOptions(within(dialog).getByLabelText("El mensaje…"), "exact");
    expect(within(dialog).queryByRole("option", { name: "Viejo" })).not.toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText("Flujo que se inicia"), "f1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Añadir disparador" }));
    expect(await within(dialog).findByText("Si el mensaje es exactamente «precio» o «cuánto cuesta»")).toBeInTheDocument();
    expect(api.triggers()[0]).toMatchObject({ type: "keyword", keywords: ["precio", "cuánto cuesta"], match: "exact", automationId: "f1" });

    // Cualquier mensaje → Soporte; después ya no se ofrece otro igual
    await userEvent.click(within(dialog).getByRole("button", { name: "Añadir disparador" }));
    await userEvent.click(within(dialog).getByRole("radio", { name: /Cualquier mensaje/ }));
    await userEvent.selectOptions(within(dialog).getByLabelText("Flujo que se inicia"), "f2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Añadir disparador" }));
    await within(dialog).findByText("Soporte");
    await userEvent.click(within(dialog).getByRole("button", { name: "Añadir disparador" }));
    expect(within(dialog).getByRole("radio", { name: /Cualquier mensaje/ })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    // Pausar y quitar
    await userEvent.click(within(dialog).getByRole("switch", { name: "Pausar palabra clave → Ventas" }));
    await vi.waitFor(() => expect(api.triggers()[0]!.enabled).toBe(false));
    await userEvent.click(within(dialog).getByRole("button", { name: "Quitar cualquier mensaje → Soporte" }));
    await vi.waitFor(() => expect(api.triggers()).toHaveLength(1));

    await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(await screen.findByRole("button", { name: "Disparadores de Ventas Colombia: 1" })).toBeInTheDocument();
  });
});
