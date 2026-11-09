import { vi } from "vitest";
import type { ConversationMessage, ConversationSummary } from "@contracts/ConversationContracts";

// ---------------------------------------------------------------------------
// API falsa CON ESTADO de la bandeja de Conversaciones. Como el servidor, el
// chat en vivo (`/live`) devuelve todo sin `since` y, con `since`, solo lo
// nuevo o cambiado desde esa marca (`upsert` simula un mensaje que sale o un
// aviso de entregado/leído mientras el chat está abierto).
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

export const NOW = new Date().toISOString();
export const VIP = { id: "l-vip", name: "VIP", color: "#f59e0b" };
export const PAGO = { id: "l-pago", name: "Pagó", color: "#16a34a" };
export const CHAT: ConversationSummary = {
  id: "c1", connectionId: "w1", connectionName: "venta", contactId: "k1", contactName: "Laura Gómez", phone: "573001112233",
  botEnabled: true, unreadCount: 2, lastMessageText: "Te envío info", lastMessageAuthor: "bot", lastMessageAt: NOW, activeFlowName: "Ventas",
  labels: [VIP], connectionDeleted: false, createdAt: NOW
};
export const OLD_CHAT: ConversationSummary = {
  ...CHAT, id: "c2", contactId: "k2", contactName: "Pedro Ruiz", phone: "573004445566", unreadCount: 0, labels: [],
  lastMessageText: "Gracias", lastMessageAuthor: "contact", lastMessageAt: "2026-01-02T10:00:00.000Z", activeFlowName: null
};

let sequence = 0;
export const msg = (over: Partial<ConversationMessage>): ConversationMessage => ({
  id: `m${++sequence}`, conversationId: "c1", direction: "inbound", author: "contact", kind: "text", text: "", mediaUrl: null, mediaType: null,
  options: [], status: "received", error: null, flowName: null, agentName: null, createdAt: NOW, ...over
});

export function stubConversationsApi(options: { paged?: boolean; deleted?: boolean; messages?: ConversationMessage[] } = {}) {
  let chat = { ...CHAT, connectionDeleted: options.deleted ?? false };
  const listCalls: URLSearchParams[] = [];
  const liveCalls: URLSearchParams[] = [];
  const messages: ConversationMessage[] = options.messages ?? [
    msg({ text: "Hola" }),
    msg({ direction: "outbound", author: "bot", status: "sent", text: "¿Qué buscas?", flowName: "Ventas", kind: "menu", options: ["Ver precios", "Asesor"] }),
    msg({ direction: "outbound", author: "bot", status: "failed", text: "Catálogo", error: "uazapi no disponible (503)" })
  ];
  // Marca de cambios: cada mensaje guarda la versión en que cambió por última vez.
  let version = 0;
  const changedAt = new Map<string, number>();
  const touch = (message: ConversationMessage) => changedAt.set(message.id, ++version);
  messages.forEach(touch);
  const upsert = (message: ConversationMessage) => {
    const index = messages.findIndex((known) => known.id === message.id);
    if (index >= 0) messages[index] = message;
    else messages.push(message);
    touch(message);
  };

  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (url.pathname === "/conversations") {
      listCalls.push(url.searchParams);
      if (options.paged) {
        return url.searchParams.get("cursor") === "page-2"
          ? reply(200, { conversations: [OLD_CHAT], nextCursor: null })
          : reply(200, { conversations: [chat], nextCursor: "page-2" });
      }
      return reply(200, { conversations: [chat], nextCursor: null });
    }
    if (url.pathname === "/connections") return reply(200, { connections: [] });
    if (url.pathname === "/labels") return reply(200, { labels: [VIP, PAGO] });
    if (url.pathname === "/automations") return reply(200, { flows: [{ id: "f1", key: "f1", name: "Ventas", status: "active" }, { id: "f2", key: "f2", name: "Viejo", status: "archived" }], folders: [] });
    if (url.pathname === "/conversations/c1/live") {
      liveCalls.push(url.searchParams);
      const since = url.searchParams.get("since");
      const list = since === null ? messages : messages.filter((message) => (changedAt.get(message.id) ?? 0) > Number(since));
      return reply(200, { conversation: chat, messages: [...list], hasMore: false, cursor: String(version) });
    }
    if (url.pathname === "/conversations/c1" && method === "GET") return reply(200, chat);
    if (url.pathname === "/conversations/c1" && method === "PATCH") {
      chat = { ...chat, botEnabled: body["botEnabled"] as boolean };
      return reply(200, chat);
    }
    if (url.pathname === "/conversations/c1/read") {
      chat = { ...chat, unreadCount: 0 };
      return reply(204);
    }
    if (url.pathname === "/conversations/c1/labels" && method === "PUT") {
      const ids = body["labelIds"] as string[];
      chat = { ...chat, labels: [VIP, PAGO].filter((label) => ids.includes(label.id)) };
      return reply(200, chat);
    }
    if (url.pathname === "/conversations/c1/messages" && method === "GET") return reply(200, { messages, hasMore: false });
    if (url.pathname === "/conversations/c1/messages" && method === "POST") {
      upsert(msg({ direction: "outbound", author: "agent", status: "sent", text: String(body["text"]) }));
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
  return { fetchMock, messages, upsert, listCalls, liveCalls, last: () => listCalls.at(-1)! };
}
