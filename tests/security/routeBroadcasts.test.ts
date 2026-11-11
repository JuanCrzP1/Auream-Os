import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeBroadcastsRequest, type BroadcastRoutes } from "../../apps/api/routes/routeBroadcastsRequest.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Difusiones por HTTP: todo el equipo ve los resultados; crear, enviar,
// pausar, cancelar, probar y las audiencias son de dueños y administradores
// (una difusión habla en nombre del negocio). La cuenta sale del contexto.
// ---------------------------------------------------------------------------

const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {} }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

const module = () => ({
  broadcasts: {
    list: vi.fn(async () => ({ broadcasts: [] })),
    detail: vi.fn(async () => ({})),
    recipients: vi.fn(async () => ({ recipients: [] })),
    create: vi.fn(async () => ({ id: ID })),
    pause: vi.fn(async () => ({})),
    resume: vi.fn(async () => ({})),
    cancel: vi.fn(async () => ({})),
    test: vi.fn(async () => ({ ok: true }))
  },
  audiences: { preview: vi.fn(async () => ({ count: 3 })), list: vi.fn(async () => []), save: vi.fn(async () => ({})), remove: vi.fn(async () => {}) }
});

async function run(m: ReturnType<typeof module>, method: string, path: string, role: keyof typeof ROLE_SCOPES, body?: unknown) {
  const r = res();
  const url = new URL(`http://x${path}`);
  await routeBroadcastsRequest(req(method, path, body), r as never, url, m as unknown as BroadcastRoutes, makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId: "tenant-a", actorId: "user-a" }));
  return r.statusCode;
}

describe("Difusiones por HTTP", () => {
  it("todo el equipo ve la lista, cada difusión y sus destinatarios", async () => {
    const m = module();
    for (const role of ["tenant_owner", "tenant_admin", "operator", "viewer"] as const) {
      expect(await run(m, "GET", "/broadcasts", role)).toBe(200);
    }
    expect(await run(m, "GET", `/broadcasts/${ID}`, "viewer")).toBe(200);
    expect(await run(m, "GET", `/broadcasts/${ID}/recipients?filter=bought&offset=50`, "operator")).toBe(200);
    expect(m.broadcasts.recipients).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a", canManage: false }), ID, "bought", 50);
  });

  it("crear, pausar, seguir, cancelar, probar y las audiencias: dueños y administradores", async () => {
    const m = module();
    expect(await run(m, "POST", "/broadcasts", "tenant_owner", { name: "Promo" })).toBe(201);
    expect(m.broadcasts.create).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-a", canManage: true }, { name: "Promo" });
    expect(await run(m, "POST", `/broadcasts/${ID}/pause`, "tenant_admin")).toBe(200);
    expect(await run(m, "POST", `/broadcasts/${ID}/resume`, "tenant_admin")).toBe(200);
    expect(await run(m, "POST", `/broadcasts/${ID}/cancel`, "tenant_admin")).toBe(200);
    expect(m.broadcasts.cancel).toHaveBeenCalledTimes(1);
    expect(await run(m, "POST", "/broadcasts/test", "tenant_admin", {})).toBe(200);
    expect(await run(m, "POST", "/broadcasts/audience/preview", "tenant_admin", {})).toBe(200);
    expect(await run(m, "GET", "/broadcasts/audiences", "tenant_admin")).toBe(200);
    expect(await run(m, "POST", "/broadcasts/audiences", "tenant_admin", { name: "VIP" })).toBe(201);
    expect(await run(m, "DELETE", `/broadcasts/audiences/${ID}`, "tenant_admin")).toBe(204);
  });

  it("el Asesor y Solo lectura no envían ni ven a quién le llegaría", async () => {
    const m = module();
    for (const role of ["operator", "viewer"] as const) {
      await expect(run(m, "POST", "/broadcasts", role, {})).rejects.toBeInstanceOf(AccessError);
      await expect(run(m, "POST", `/broadcasts/${ID}/cancel`, role)).rejects.toBeInstanceOf(AccessError);
      await expect(run(m, "POST", "/broadcasts/audience/preview", role, {})).rejects.toBeInstanceOf(AccessError);
      await expect(run(m, "GET", "/broadcasts/audiences", role)).rejects.toBeInstanceOf(AccessError);
    }
    expect(m.broadcasts.create).not.toHaveBeenCalled();
    expect(m.audiences.preview).not.toHaveBeenCalled();
  });

  it("sin el módulo responde 503; otras rutas no son suyas", async () => {
    const r = res();
    await routeBroadcastsRequest(req("GET", "/broadcasts"), r as never, new URL("http://x/broadcasts"), undefined, makeContext({ scopes: [...ROLE_SCOPES.tenant_owner] }));
    expect(r.statusCode).toBe(503);
    expect(await routeBroadcastsRequest(req("GET", "/crm"), res() as never, new URL("http://x/crm"), undefined, makeContext({}))).toBe(false);
  });
});
