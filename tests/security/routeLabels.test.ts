import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeLabelsRequest } from "../../apps/api/routes/routeLabelsRequest.js";
import type { LabelManagementServices } from "../../domains/labels/application/LabelManagementServices.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Etiquetas por HTTP: todos los que ven contactos ven quién usa cada una (y
// las ventas solo quien ve ventas); el Asesor les cambia el color; unir,
// borrar y renombrar es de dueños y administradores, porque una etiqueta
// puede ser una etapa del embudo y los flujos la nombran.
// ---------------------------------------------------------------------------

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: { "content-type": "application/json" }, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

const ID = "11111111-1111-4111-8111-111111111111";

function services() {
  return {
    overview: vi.fn(async (actor) => ({ actor })),
    merge: vi.fn(async () => ({ merge: { id: "m1" }, flowsSkipped: [] })),
    update: vi.fn(async () => ({ label: { id: ID, name: "VIP", color: "#000000" }, flowsSkipped: [] })),
    remove: vi.fn(async () => null)
  };
}

async function run(s: ReturnType<typeof services>, method: string, path: string, role: keyof typeof ROLE_SCOPES, body?: unknown) {
  const r = res();
  const handled = await routeLabelsRequest(req(method, path, body), r as never, new URL(`http://x${path}`), s as unknown as LabelManagementServices, makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId: "tenant-a", actorId: "user-a" }));
  return { handled, status: r.statusCode, body: r.body ? JSON.parse(r.body) : null };
}

describe("/labels (gestión)", () => {
  it("el resumen lo ven todos; las ventas solo quien las ve; el tenant sale del contexto", async () => {
    const s = services();
    expect((await run(s, "GET", "/labels/overview", "operator")).body.actor).toEqual({ tenantId: "tenant-a", actorId: "user-a", canManage: false, canEdit: true, canSeeSales: true });
    expect((await run(s, "GET", "/labels/overview", "tenant_admin")).body.actor).toMatchObject({ canManage: true });
    expect((await run(s, "GET", "/labels/overview", "viewer")).body.actor).toMatchObject({ canManage: false, canEdit: false });
  });

  it("unir y borrar: dueños y administradores; el Asesor ni Solo lectura", async () => {
    for (const role of ["operator", "viewer"] as const) {
      const s = services();
      await expect(run(s, "POST", "/labels/merge", role, { from: ID, into: ID })).rejects.toBeInstanceOf(AccessError);
      await expect(run(s, "DELETE", `/labels/${ID}`, role)).rejects.toBeInstanceOf(AccessError);
      expect(s.merge).not.toHaveBeenCalled();
      expect(s.remove).not.toHaveBeenCalled();
    }
    const s = services();
    expect((await run(s, "POST", "/labels/merge", "tenant_admin", { from: ID, into: ID })).status).toBe(202);
    expect((await run(s, "DELETE", `/labels/${ID}?into=${ID}`, "tenant_owner")).status).toBe(200);
    expect(s.remove).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a" }), ID, ID);
  });

  it("cambiar: Solo lectura no; el Asesor llega al servicio, que solo le deja el color", async () => {
    await expect(run(services(), "PATCH", `/labels/${ID}`, "viewer", { color: "#000000" })).rejects.toBeInstanceOf(AccessError);
    const s = services();
    expect((await run(s, "PATCH", `/labels/${ID}`, "operator", { color: "#000000" })).body).toEqual({ id: ID, name: "VIP", color: "#000000", flowsSkipped: [] });
    expect(s.update).toHaveBeenCalledWith(expect.objectContaining({ canManage: false, canEdit: true }), ID, { color: "#000000" });
  });

  it("lo que no es suyo (listar y crear) sigue en Contactos", async () => {
    expect((await run(services(), "GET", "/labels", "tenant_owner")).handled).toBe(false);
    expect((await run(services(), "POST", "/labels", "tenant_owner", { name: "x" })).handled).toBe(false);
  });
});
