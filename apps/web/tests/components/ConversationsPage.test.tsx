import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationsPage } from "../../src/features/conversations/pages/ConversationsPage";
import type { ConversationMessage, ConversationSummary } from "@contracts/ConversationContracts";

// ---------------------------------------------------------------------------
// Bandeja de Conversaciones: la lista con no leídos, abrir un chat con su
// hilo (cliente, bot y un envío fallido), responder como asesor (pausa el
// bot), reactivar el bot y enviar un flujo a mano. API falsa con estado.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const now = new Date().toISOString();
const CHAT: ConversationSummary = {
  id: "c1", connectionId: "w1", connectionName: "venta", contactId: "k1", contactName: "Laura Gómez", phone: "573001112233",
  botEnabled: true, unreadCount: 2, lastMessageText: "Te envío info", lastMessageAuthor: "bot", lastMessageAt: now, activeFlowName: "Ventas", createdAt: now
};
const msg = (over: Partial<ConversationMessage>): ConversationMessage => ({
  id: `m${Math.random()}`, conversationId: "c1", direction: "inbound", author: "contact", kind: "text", text: "", mediaUrl: null, mediaType: null,
  options: [], status: "received", error: null, flowName: null, agentName: null, createdAt: now, ...over
});

function stubApi() {
  let chat = { ...CHAT };
  const messages: ConversationMessage[] = [
    msg({ text: "Hola" }),
    msg({ direction: "outbound", author: "bot", status: "sent", text: "¿Qué buscas?", flowName: "Ventas", kind: "menu", options: ["Ver precios", "Asesor"] }),
    msg({ direction: "outbound", author: "bot", status: "failed", text: "Catálogo", error: "uazapi no disponible (503)" })
  ];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (url.pathname === "/conversations") return reply(200, { conversations: [chat] });
    if (url.pathname === "/connections") return reply(200, { connections: [] });
    if (url.pathname === "/automations") return reply(200, { flows: [{ id: "f1", key: "f1", name: "Ventas", status: "active" }, { id: "f2", key: "f2", name: "Viejo", status: "archived" }], folders: [] });
    if (url.pathname === "/conversations/c1" && method === "GET") return reply(200, chat);
    if (url.pathname === "/conversations/c1" && method === "PATCH") {
      chat = { ...chat, botEnabled: body["botEnabled"] as boolean };
      return reply(200, chat);
    }
    if (url.pathname === "/conversations/c1/read") {
      chat = { ...chat, unreadCount: 0 };
      return reply(204);
    }
    if (url.pathname === "/conversations/c1/messages" && method === "GET") return reply(200, { messages, hasMore: false });
    if (url.pathname === "/conversations/c1/messages" && method === "POST") {
      messages.push(msg({ direction: "outbound", author: "agent", status: "sent", text: String(body["text"]) }));
      chat = { ...chat, botEnabled: false };
      return reply(200, chat);
    }
    if (url.pathname === "/conversations/c1/flows") {
      chat = { ...chat, botEnabled: true };
      return reply(200, { flowName: "Ventas", sent: 2, failed: 0 });
    }
    return reply(404, { message: "no" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, messages };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ConversationsPage", () => {
  it("lista los chats y abre uno con su hilo: cliente, bot con menú y un envío fallido", async () => {
    const api = stubApi();
    render(<ConversationsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Laura Gómez, 2 sin leer" }));

    const chat = await screen.findByRole("region", { name: "Chat con Laura Gómez" });
    expect(await within(chat).findByText("Hola")).toBeInTheDocument();
    expect(within(chat).getByText("🤖 Ventas")).toBeInTheDocument();
    expect(within(chat).getByLabelText("Opciones enviadas")).toHaveTextContent("Ver precios");
    expect(within(chat).getByText("No se envió: uazapi no disponible (503)")).toBeInTheDocument();
    expect(within(chat).getByText(/en «Ventas»/)).toBeInTheDocument();
    await vi.waitFor(() => expect(api.fetchMock.mock.calls.some(([u]) => String(u).endsWith("/conversations/c1/read"))).toBe(true));
  });

  it("responder como asesor envía, aparece en el hilo y pausa el bot; se puede reactivar", async () => {
    stubApi();
    render(<ConversationsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Laura Gómez/ }));
    const chat = await screen.findByRole("region", { name: "Chat con Laura Gómez" });

    await userEvent.type(await within(chat).findByLabelText("Escribe un mensaje"), "Hola, te ayudo yo{Enter}");
    expect(await within(chat).findByText("Hola, te ayudo yo")).toBeInTheDocument();
    const toggle = within(chat).getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(within(chat).getByText(/Atiendes este chat/)).toBeInTheDocument();

    await userEvent.click(toggle);
    await vi.waitFor(() => expect(within(chat).getByRole("switch")).toHaveAttribute("aria-checked", "true"));
  });

  it("enviar un flujo a mano: solo flujos no archivados, y confirma lo enviado", async () => {
    const api = stubApi();
    render(<ConversationsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /Laura Gómez/ }));
    const chat = await screen.findByRole("region", { name: "Chat con Laura Gómez" });

    await userEvent.click(await within(chat).findByRole("button", { name: "Enviar un flujo" }));
    const dialog = await screen.findByRole("dialog", { name: "Enviar un flujo a Laura Gómez" });
    expect(await within(dialog).findByText("Ventas")).toBeInTheDocument();
    expect(within(dialog).queryByText("Viejo")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Ventas/ }));

    expect(await within(chat).findByText("Se envió «Ventas».")).toBeInTheDocument();
    const call = api.fetchMock.mock.calls.find(([u]) => String(u).endsWith("/conversations/c1/flows"));
    expect(JSON.parse(String(call![1]!.body))).toEqual({ automationId: "f1" });
  });
});
