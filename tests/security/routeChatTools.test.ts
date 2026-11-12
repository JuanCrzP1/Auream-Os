import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeConversationsRequest } from "../../apps/api/routes/routeConversationsRequest.js";
import { routeQuickRepliesRequest } from "../../apps/api/routes/routeQuickRepliesRequest.js";
import { routeContactNotesRequest } from "../../apps/api/routes/routeContactNotesRequest.js";
import type { MessagingServices } from "../../apps/api/composition/composeMessagingServices.js";
import type { QuickReplyServices } from "../../domains/quick-replies/application/QuickReplyServices.js";
import type { ContactNoteServices } from "../../domains/contacts/application/ContactNoteServices.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Herramientas del chat por HTTP: cada rol hace solo lo que le toca.
//   asesor          atiende (tomar, resolver, chat nuevo), usa respuestas
//                   rápidas y anota
//   solo lectura    ve, pero no atiende ni anota
//   dueño / admin   además elimina chats y organiza las respuestas rápidas
// ---------------------------------------------------------------------------

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]), { method, url: path, headers: { "content-type": "application/json" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};
const context = (role: keyof typeof ROLE_SCOPES) => makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId: "tenant-a", actorId: "user-a" });

const conversations = {
  conversations: { remove: vi.fn(async () => undefined) },
  attention: { take: vi.fn(async () => ({ id: "c1" })), resolve: vi.fn(async () => ({ id: "c1" })), agents: vi.fn(async () => []) },
  newChats: { start: vi.fn(async () => ({ id: "c2" })) },
  adOrigin: { get: vi.fn(async () => ({ ad: null })) }
} as unknown as MessagingServices;

async function call(role: keyof typeof ROLE_SCOPES, method: string, path: string, body?: unknown) {
  const r = res();
  try {
    await routeConversationsRequest(req(method, path, body), r as never, new URL(`http://x${path}`), conversations, context(role));
    return r.statusCode;
  } catch (error) {
    return (error as { status?: number; statusCode?: number }).statusCode ?? (error as { status?: number }).status ?? 500;
  }
}

describe("Herramientas del chat por HTTP", () => {
  it("el anuncio de origen lo ve todo el equipo (también solo lectura); sin permiso de chats, no", async () => {
    expect(await call("viewer", "GET", "/conversations/c1/ad")).toBe(200);
    expect(await call("operator", "GET", "/conversations/c1/ad")).toBe(200);
    expect((conversations as unknown as { adOrigin: { get: ReturnType<typeof vi.fn> } }).adOrigin.get).toHaveBeenCalledWith("tenant-a", "c1");
    expect(await call("api_client", "GET", "/conversations/c1/ad")).toBe(403);
  });

  it("tomar, resolver y chat nuevo: quien atiende sí, solo lectura no", async () => {
    expect(await call("operator", "POST", "/conversations/c1/take")).toBe(200);
    expect(await call("operator", "POST", "/conversations/c1/resolve")).toBe(200);
    expect(await call("operator", "POST", "/conversations", { connectionId: "w1", phone: "573001112233", message: { text: "Hola" } })).toBe(201);
    expect(await call("viewer", "POST", "/conversations/c1/take")).toBe(403);
    expect(await call("viewer", "GET", "/conversations/agents")).toBe(200);
  });

  it("eliminar un chat: solo dueños y administradores", async () => {
    expect(await call("operator", "DELETE", "/conversations/c1")).toBe(403);
    expect(await call("tenant_admin", "DELETE", "/conversations/c1")).toBe(204);
  });

  it("respuestas rápidas: todos las ven, el asesor las usa, solo dueños y administradores las organizan", async () => {
    const services = { list: vi.fn(async () => []), create: vi.fn(async () => ({})), markUsed: vi.fn(async () => undefined) } as unknown as QuickReplyServices;
    const run = async (role: keyof typeof ROLE_SCOPES, method: string, path: string, body?: unknown) => {
      const r = res();
      try {
        await routeQuickRepliesRequest(req(method, path, body), r as never, new URL(`http://x${path}`), services, context(role));
        return { status: r.statusCode, body: r.body };
      } catch (error) {
        return { status: (error as { statusCode?: number }).statusCode ?? 500, body: "" };
      }
    };
    expect(JSON.parse((await run("operator", "GET", "/quick-replies")).body)).toEqual({ quickReplies: [], canManage: false });
    expect((await run("operator", "POST", "/quick-replies/q1/use")).status).toBe(204);
    expect((await run("operator", "POST", "/quick-replies", { shortcut: "hola", pieces: [] })).status).toBe(403);
    expect((await run("tenant_owner", "POST", "/quick-replies", { shortcut: "hola", pieces: [] })).status).toBe(201);
  });

  it("notas internas: el asesor anota, solo lectura solo las ve", async () => {
    const services = { list: vi.fn(async () => []), add: vi.fn(async () => ({})) } as unknown as ContactNoteServices;
    const run = async (role: keyof typeof ROLE_SCOPES, method: string) => {
      const r = res();
      try {
        await routeContactNotesRequest(req(method, "/contacts/k1/notes", method === "POST" ? { body: "x" } : undefined), r as never, new URL("http://x/contacts/k1/notes"), services, context(role));
        return r.statusCode;
      } catch (error) {
        return (error as { statusCode?: number }).statusCode ?? 500;
      }
    };
    expect(await run("viewer", "GET")).toBe(200);
    expect(await run("viewer", "POST")).toBe(403);
    expect(await run("operator", "POST")).toBe(201);
  });
});
