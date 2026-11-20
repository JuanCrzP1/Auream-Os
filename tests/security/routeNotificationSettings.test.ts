import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeNotificationSettingsRequest } from "../../apps/api/routes/routeNotificationSettingsRequest.js";
import type { NotificationSettingsServices } from "../../domains/notifications/application/NotificationSettingsServices.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Configuración › Notificaciones por HTTP: todo el equipo maneja lo SUYO (sus
// dispositivos y qué le suena); una credencial o la clave de desarrollo no
// tienen dispositivos; cada servicio recibe a la persona con sus permisos.
// ---------------------------------------------------------------------------

const ME = "11111111-1111-4111-8111-111111111111";
const DEVICE = "aaaaaaaa-0000-4000-8000-000000000001";
const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {}, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};
const services = () => ({
  view: vi.fn(async () => ({ topics: [] })),
  setTopic: vi.fn(async () => ({ topics: [] })),
  subscribe: vi.fn(async () => ({ deviceId: DEVICE })),
  removeDevice: vi.fn(async () => ({ devices: [] })),
  test: vi.fn(async () => ({ sent: true }))
});

async function run(m: ReturnType<typeof services>, method: string, path: string, scopes: ReadonlyArray<string>, actorId = ME, body?: unknown) {
  const r = res();
  const handled = await routeNotificationSettingsRequest(req(method, path, body), r as never, new URL(`http://x${path}`), m as unknown as NotificationSettingsServices, makeContext({ scopes: [...scopes], tenantId: "tenant-a", actorId }));
  return { ...r, handled };
}

describe("Notificaciones por HTTP", () => {
  it("cada rol del equipo ve y cambia lo suyo; el servicio recibe a la persona con sus permisos", async () => {
    const m = services();
    for (const role of ["tenant_owner", "tenant_admin", "operator", "viewer"] as const) {
      expect((await run(m, "GET", "/notifications/settings", ROLE_SCOPES[role])).statusCode).toBe(200);
    }
    expect(m.view).toHaveBeenLastCalledWith({ tenantId: "tenant-a", userId: ME, scopes: [...ROLE_SCOPES.viewer] });
    expect((await run(m, "PUT", "/notifications/settings/topics/chat_message", ROLE_SCOPES.operator, ME, { enabled: false })).statusCode).toBe(200);
    expect(m.setTopic).toHaveBeenCalledWith(expect.objectContaining({ userId: ME }), "chat_message", false);
    expect((await run(m, "POST", "/notifications/push/devices", ROLE_SCOPES.operator, ME, { endpoint: "https://fcm.googleapis.com/x" })).statusCode).toBe(201);
    expect((await run(m, "POST", `/notifications/push/devices/${DEVICE}/test`, ROLE_SCOPES.operator)).statusCode).toBe(200);
    expect(m.test).toHaveBeenCalledWith(expect.objectContaining({ userId: ME }), DEVICE);
    expect((await run(m, "DELETE", `/notifications/push/devices/${DEVICE}`, ROLE_SCOPES.operator)).statusCode).toBe(200);
    expect(m.removeDevice).toHaveBeenCalledWith(expect.objectContaining({ userId: ME }), DEVICE);
  });

  it("sin ser del equipo no entra; una credencial o la clave de desarrollo no tienen dispositivos", async () => {
    const m = services();
    await expect(run(m, "GET", "/notifications/settings", ROLE_SCOPES.api_client)).rejects.toBeInstanceOf(AccessError);
    const dev = await run(m, "GET", "/notifications/settings", ROLE_SCOPES.tenant_owner, "dev-user");
    expect(dev.statusCode).toBe(403);
    expect(m.view).not.toHaveBeenCalled();
  });

  it("no toma la campana ni otras rutas; un método que no existe responde 405", async () => {
    const m = services();
    expect((await run(m, "GET", "/notifications", ROLE_SCOPES.tenant_owner)).handled).toBe(false);
    expect((await run(m, "GET", "/notifications/seen", ROLE_SCOPES.tenant_owner)).handled).toBe(false);
    expect((await run(m, "PATCH", "/notifications/settings", ROLE_SCOPES.tenant_owner)).statusCode).toBe(405);
    expect((await run(m, "GET", `/notifications/push/devices/${DEVICE}`, ROLE_SCOPES.tenant_owner)).statusCode).toBe(405);
  });
});
