import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeCrmRequest, type CrmRoutes } from "../../apps/api/routes/routeCrmRequest.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// CRM por HTTP: ver es de todo el equipo (`crm.read`); mover clientes, poner
// valor y responsable y llevar seguimientos, del Asesor en adelante
// (`crm.write`); configurar embudos, de dueños y administradores
// (`crm.manage`). La cuenta y quien actúa salen SIEMPRE del contexto.
// ---------------------------------------------------------------------------

const P = "aaaaaaaa-0000-4000-8000-000000000001";
const S = "aaaaaaaa-0000-4000-8000-000000000002";
const C = "aaaaaaaa-0000-4000-8000-000000000003";

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {}, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

const module = () => ({
  pipelines: { list: vi.fn(async () => ({ pipelines: [] })), create: vi.fn(async () => ({ id: P })), createStarter: vi.fn(async () => ({ id: P })), update: vi.fn(async () => ({ id: P })), remove: vi.fn(async () => {}) },
  board: { view: vi.fn(async () => ({ columns: [] })), stageCards: vi.fn(async () => ({ cards: [] })), move: vi.fn(async () => {}), remove: vi.fn(async () => {}) },
  deals: { update: vi.fn(async () => ({})), contact: vi.fn(async () => ({ deals: [] })) },
  followUps: { list: vi.fn(async () => ({ followUps: [] })), create: vi.fn(async () => ({})), update: vi.fn(async () => ({})), remove: vi.fn(async () => {}) }
});

async function run(m: ReturnType<typeof module> | undefined, method: string, path: string, role: keyof typeof ROLE_SCOPES, body?: unknown) {
  const response = res();
  const scopes = [...ROLE_SCOPES[role]];
  const handled = await routeCrmRequest(req(method, path, body), response as never, new URL(`http://x${path}`), m as unknown as CrmRoutes, makeContext({ scopes, tenantId: "tenant-a", actorId: "user-a" }));
  return { handled, status: response.statusCode };
}

describe("routeCrmRequest", () => {
  it("todo el equipo ve embudos, tablero, ficha y seguimientos de SU cuenta", async () => {
    const m = module();
    expect((await run(m, "GET", "/crm/pipelines", "viewer")).status).toBe(200);
    expect(m.pipelines.list).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-a", canWrite: false, canManage: false });
    expect((await run(m, "GET", `/crm/pipelines/${P}/board?owner=me&search=ana`, "viewer")).status).toBe(200);
    expect(m.board.view).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a" }), P, { owner: "me", search: "ana" });
    expect((await run(m, "GET", `/crm/pipelines/${P}/stages/${S}/cards?offset=25`, "viewer")).status).toBe(200);
    expect(m.board.stageCards).toHaveBeenCalledWith(expect.anything(), P, S, expect.anything(), 25);
    expect((await run(m, "GET", `/crm/contacts/${C}`, "viewer")).status).toBe(200);
    expect((await run(m, "GET", "/crm/follow-ups?bucket=overdue&assignee=all", "viewer")).status).toBe(200);
    expect(m.followUps.list).toHaveBeenCalledWith(expect.anything(), { bucket: "overdue", assignee: "all" });
  });

  it("el Asesor mueve clientes, cambia valor y lleva seguimientos; solo lectura no", async () => {
    const m = module();
    expect((await run(m, "PUT", `/crm/pipelines/${P}/deals/${C}/stage`, "operator", { stageId: S })).status).toBe(204);
    expect(m.board.move).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-a", canWrite: true, canManage: false }), P, C, { stageId: S });
    expect((await run(m, "PATCH", `/crm/pipelines/${P}/deals/${C}`, "operator", { amount: 1 })).status).toBe(200);
    expect((await run(m, "DELETE", `/crm/pipelines/${P}/deals/${C}`, "operator")).status).toBe(204);
    expect((await run(m, "POST", "/crm/follow-ups", "operator", { title: "x" })).status).toBe(201);
    expect((await run(m, "PATCH", `/crm/follow-ups/${C}`, "operator", { done: true })).status).toBe(200);
    expect((await run(m, "DELETE", `/crm/follow-ups/${C}`, "operator")).status).toBe(204);
    await expect(run(m, "PUT", `/crm/pipelines/${P}/deals/${C}/stage`, "viewer", { stageId: S })).rejects.toBeInstanceOf(AccessError);
    await expect(run(m, "POST", "/crm/follow-ups", "viewer", { title: "x" })).rejects.toBeInstanceOf(AccessError);
  });

  it("configurar embudos es de dueños y administradores", async () => {
    const m = module();
    expect((await run(m, "POST", "/crm/pipelines/starter", "tenant_admin")).status).toBe(201);
    expect((await run(m, "POST", "/crm/pipelines", "tenant_owner", { name: "V" })).status).toBe(201);
    expect((await run(m, "PATCH", `/crm/pipelines/${P}`, "tenant_admin", { name: "V" })).status).toBe(200);
    expect((await run(m, "DELETE", `/crm/pipelines/${P}`, "tenant_owner")).status).toBe(204);
    await expect(run(m, "PATCH", `/crm/pipelines/${P}`, "operator", { name: "V" })).rejects.toBeInstanceOf(AccessError);
    await expect(run(m, "POST", "/crm/pipelines/starter", "operator")).rejects.toBeInstanceOf(AccessError);
  });

  it("no toca otras rutas; sin módulo responde 503", async () => {
    expect((await run(module(), "GET", "/sales", "viewer")).handled).toBe(false);
    expect((await run(undefined, "GET", "/crm/pipelines", "viewer")).status).toBe(503);
  });
});
