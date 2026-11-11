import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { notificationViewer, routeNotificationsRequest } from "../../apps/api/routes/routeNotificationsRequest.js";
import type { NotificationServices } from "../../domains/notifications/application/NotificationServices.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// La campana por HTTP: cada persona ve solo los avisos de los módulos que
// puede leer, siempre de su cuenta y con su propio «visto».
// ---------------------------------------------------------------------------

const req = (method: string, path: string) => Object.assign(Readable.from([]), { method, url: path, headers: {} }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};
const context = (role: keyof typeof ROLE_SCOPES) => makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId: "tenant-a", actorId: "user-a" });

describe("Notificaciones por HTTP", () => {
  it("cada aviso solo si la persona puede leer su módulo", () => {
    expect([...notificationViewer(context("tenant_owner")).kinds].sort()).toEqual(["broadcast_auto_paused", "follow_ups_due", "group_created", "number_disconnected", "sales_review"]);
    expect([...notificationViewer(context("viewer")).kinds]).toHaveLength(5);
    expect(notificationViewer(context("api_client")).kinds.size).toBe(0);
    expect(notificationViewer(makeContext({ scopes: ["sales.read"], tenantId: "t", actorId: "u" })).kinds).toEqual(new Set(["sales_review"]));
  });

  it("los avisos y «visto» son de quien pregunta, en su cuenta", async () => {
    const services = { feed: vi.fn(async () => ({ items: [], unread: 0 })), markSeen: vi.fn(async () => undefined) };
    const get = res();
    await routeNotificationsRequest(req("GET", "/notifications"), get as never, new URL("http://x/notifications"), services as unknown as NotificationServices, context("operator"));
    expect(get.statusCode).toBe(200);
    expect(services.feed).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", userId: "user-a" }));
    const seen = res();
    await routeNotificationsRequest(req("POST", "/notifications/seen"), seen as never, new URL("http://x/notifications/seen"), services as unknown as NotificationServices, context("operator"));
    expect(seen.statusCode).toBe(204);
    const missing = res();
    expect(await routeNotificationsRequest(req("GET", "/notifications"), missing as never, new URL("http://x/notifications"), undefined, context("operator"))).toBe(true);
    expect(missing.statusCode).toBe(503);
    expect(await routeNotificationsRequest(req("GET", "/notificationsx"), res() as never, new URL("http://x/notificationsx"), undefined, context("operator"))).toBe(false);
  });
});
