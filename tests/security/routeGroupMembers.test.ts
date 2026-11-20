import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeGroupMembersRequest } from "../../apps/api/routes/routeGroupMembersRequest.js";
import type { GroupMemberServices } from "../../domains/groups/application/GroupMemberServices.js";
import { AuditLogger } from "../../platform/observability/audit/AuditLogger.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { InMemoryAuditEventStore } from "../../infrastructure/persistence/memory/InMemoryAuditEventStore.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Los miembros de un grupo por HTTP. Son datos de clientes:
//   · verlos: grupos + contactos (todo el equipo); la plata, solo con ventas
//   · etiquetarlos: dueños y administradores (grupos y contactos para editar)
//   · descargarlos: dueños y administradores, y QUEDA REGISTRADO; sin registro
//     (o si el registro falla) no sale el archivo
// ---------------------------------------------------------------------------

const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {}, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};
const members = () => ({
  page: vi.fn(async () => ({ members: [] })),
  label: vi.fn(async () => ({ label: "X", labeled: 0, remaining: 0 })),
  export: vi.fn(async () => ({ name: "miembros_Grupo_todos", columns: ["Nombre", "Teléfono"], rows: [["=HYPERLINK(1)", "57 300 000 0001"]], truncated: false }))
});

async function run(m: ReturnType<typeof members>, method: string, path: string, scopes: ReadonlyArray<string>, options: { body?: unknown; audit?: AuditLogger | null } = {}) {
  const r = res();
  const audit = options.audit === undefined ? new AuditLogger(new InMemoryAuditEventStore()) : (options.audit ?? undefined);
  await routeGroupMembersRequest(req(method, path, options.body), r as never, new URL(`http://x${path}`), m as unknown as GroupMemberServices, audit, makeContext({ scopes: [...scopes], tenantId: "tenant-a", actorId: "user-a", requestId: "req-9" }));
  return r;
}
const role = (name: keyof typeof ROLE_SCOPES) => ROLE_SCOPES[name];

describe("Miembros de un grupo por HTTP", () => {
  it("todo el equipo los ve; la plata solo quien ve ventas; sin permiso de contactos, nadie", async () => {
    const m = members();
    for (const name of ["tenant_owner", "tenant_admin", "operator", "viewer"] as const) {
      expect((await run(m, "GET", `/groups/list/${ID}/members?filter=nonBuyers&search=ana&offset=100`, role(name))).statusCode).toBe(200);
    }
    expect(m.page).toHaveBeenLastCalledWith(expect.objectContaining({ tenantId: "tenant-a", canSeeSales: true, canLabel: false, canExport: false }), ID, { filter: "nonBuyers", search: "ana", offset: "100" });
    await expect(run(m, "GET", `/groups/list/${ID}/members`, ["groups.read"])).rejects.toBeInstanceOf(AccessError);
    await run(m, "GET", `/groups/list/${ID}/members`, ["groups.read", "contacts.read"]);
    expect(m.page).toHaveBeenLastCalledWith(expect.objectContaining({ canSeeSales: false }), ID, expect.anything());
  });

  it("etiquetar es de dueños y administradores", async () => {
    const m = members();
    await expect(run(m, "POST", `/groups/list/${ID}/members/label`, role("operator"), { body: { filter: "nonBuyers", label: "X" } })).rejects.toBeInstanceOf(AccessError);
    await expect(run(m, "POST", `/groups/list/${ID}/members/label`, role("viewer"), { body: { filter: "nonBuyers", label: "X" } })).rejects.toBeInstanceOf(AccessError);
    expect(m.label).not.toHaveBeenCalled();
    expect((await run(m, "POST", `/groups/list/${ID}/members/label`, role("tenant_admin"), { body: { filter: "nonBuyers", label: "X" } })).statusCode).toBe(200);
    expect(m.label).toHaveBeenCalledWith(expect.objectContaining({ canLabel: true }), ID, { filter: "nonBuyers", label: "X" });
  });

  it("descargar es de dueños y administradores, queda registrado y sale como CSV sin fórmulas ni caché", async () => {
    const m = members();
    await expect(run(m, "GET", `/groups/list/${ID}/members/export`, role("operator"))).rejects.toBeInstanceOf(AccessError);
    await expect(run(m, "GET", `/groups/list/${ID}/members/export`, role("viewer"))).rejects.toBeInstanceOf(AccessError);
    expect(m.export).not.toHaveBeenCalled();

    const store = new InMemoryAuditEventStore();
    const r = await run(m, "GET", `/groups/list/${ID}/members/export?filter=nonBuyers`, role("tenant_owner"), { audit: new AuditLogger(store) });
    expect(r.statusCode).toBe(200);
    expect(r.headers).toMatchObject({ "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store", "X-Export-Rows": "1" });
    expect(r.body).toBe("﻿Nombre;Teléfono\r\n'=HYPERLINK(1);57 300 000 0001\r\n");
    expect(await store.findByType("tenant-a", "data.exported")).toEqual([
      expect.objectContaining({ actorId: "user-a", requestId: "req-9", metadata: { kind: "group_members", subjectId: ID, rows: 1, filters: { filter: "nonBuyers" } } })
    ]);
  });

  it("sin registro de auditoría no sale el archivo; si el registro falla, tampoco", async () => {
    const m = members();
    const none = await run(m, "GET", `/groups/list/${ID}/members/export`, role("tenant_owner"), { audit: null });
    expect(none.statusCode).toBe(503);
    expect(m.export).not.toHaveBeenCalled();
    const broken = new AuditLogger({ append: async () => { throw new Error("db down"); }, findByTenant: async () => [], findByType: async () => [] });
    const r = res();
    await expect(routeGroupMembersRequest(req("GET", `/groups/list/${ID}/members/export`), r as never, new URL(`http://x/groups/list/${ID}/members/export`), m as unknown as GroupMemberServices, broken, makeContext({ scopes: [...role("tenant_owner")], tenantId: "tenant-a" }))).rejects.toThrow("db down");
    expect(r.body).toBe("");
  });

  it("no toma otras rutas de grupos; un método que no existe responde 405", async () => {
    const m = members();
    const r = res();
    expect(await routeGroupMembersRequest(req("GET", "/groups/list"), r as never, new URL("http://x/groups/list"), m as unknown as GroupMemberServices, undefined, makeContext({ scopes: [...role("tenant_owner")] }))).toBe(false);
    expect((await run(m, "DELETE", `/groups/list/${ID}/members`, role("tenant_owner"))).statusCode).toBe(405);
  });
});
