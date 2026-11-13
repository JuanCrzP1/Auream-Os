import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeContactFieldsRequest, type ContactFieldRoutes } from "../../apps/api/routes/routeContactFieldsRequest.js";
import { ContactFieldValueServices } from "../../domains/contact-fields/application/ContactFieldValueServices.js";
import { ContactFieldServices } from "../../domains/contact-fields/application/ContactFieldServices.js";
import { InMemoryContactFieldRepository, InMemoryContactFieldValues, InMemoryFieldOrigins, observedFrom } from "../../infrastructure/persistence/memory/InMemoryContactFields.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Campos del cliente por HTTP: los ven quienes ven contactos (también el
// Asesor, para llenar la ficha); los organizan dueños y administradores, y
// borrar exige escribir la clave. Cada cuenta solo toca los suyos.
// ---------------------------------------------------------------------------

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: { "content-type": "application/json" }, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

async function run(services: ContactFieldRoutes | undefined, method: string, path: string, role: keyof typeof ROLE_SCOPES, tenantId = "tenant-a", body?: unknown) {
  const r = res();
  await routeContactFieldsRequest(req(method, path, body), r as never, new URL(`http://x${path}`), services, makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId, actorId: "user-a" }));
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null };
}

const LAURA = "cccccccc-0000-4000-8000-000000000001";

function services(): ContactFieldRoutes {
  let n = 0;
  const seen = new Map([["tenant-a", observedFrom({ ciudad: [["Medellín", 9], ["Bogotá", 4]] })]]);
  const repository = new InMemoryContactFieldRepository();
  const values = new InMemoryContactFieldValues(seen, 20);
  values.seedContact("tenant-a", LAURA, { ciudad: "Medellín", nota_interna: "x" });
  const flows = { drafts: async () => [] };
  return {
    fields: new ContactFieldServices(repository, values, flows, () => `aaaaaaaa-0000-4000-8000-00000000000${++n}`),
    values: new ContactFieldValueServices(repository, values, new InMemoryFieldOrigins(), flows, { names: async () => new Map([["user-a", "Ana"]]) })
  };
}

describe("/contact-fields", () => {
  it("dueños y administradores los organizan; el Asesor los ve sin poder cambiarlos", async () => {
    const fields = services();
    const created = await run(fields, "POST", "/contact-fields", "tenant_owner", "tenant-a", { label: "Presupuesto", type: "number" });
    expect(created).toMatchObject({ status: 201, body: { key: "presupuesto", type: "number" } });
    const id = created.body.id as string;

    expect(await run(fields, "GET", "/contact-fields", "tenant_admin")).toMatchObject({ status: 200, body: { canManage: true, undefinedKeys: 1, fields: [{ id }] } });
    expect(await run(fields, "GET", "/contact-fields", "operator")).toMatchObject({ status: 200, body: { canManage: false, fields: [{ id }] } });
    expect(await run(fields, "PATCH", `/contact-fields/${id}`, "tenant_admin", "tenant-a", { label: "Presupuesto aprox." })).toMatchObject({ status: 200, body: { label: "Presupuesto aprox." } });
    await expect(run(fields, "PATCH", `/contact-fields/${id}`, "operator", "tenant-a", { label: "X" })).rejects.toBeInstanceOf(AccessError);
    await expect(run(fields, "GET", "/contact-fields/discover", "operator")).rejects.toBeInstanceOf(AccessError);
    await expect(run(fields, "POST", "/contact-fields", "viewer", "tenant-a", { label: "X", type: "text" })).rejects.toBeInstanceOf(AccessError);
    await expect(run(fields, "DELETE", `/contact-fields/${id}?confirm=presupuesto`, "operator")).rejects.toBeInstanceOf(AccessError);
  });

  it("el primer día: proponer y convertir los que ya se guardan", async () => {
    const fields = services();
    const found = await run(fields, "GET", "/contact-fields/discover", "tenant_owner");
    expect(found.body.suggestions).toEqual([expect.objectContaining({ key: "ciudad", suggestedType: "list", suggestedOptions: ["Medellín", "Bogotá"] })]);
    const adopted = await run(fields, "POST", "/contact-fields/adopt", "tenant_owner", "tenant-a", { fields: [{ key: "ciudad", label: "Ciudad", type: "list", options: ["Medellín", "Bogotá"] }] });
    expect(adopted).toMatchObject({ status: 201, body: { fields: [{ key: "ciudad" }] } });
    expect((await run(fields, "GET", "/contact-fields", "tenant_owner")).body).toMatchObject({ undefinedKeys: 0, fields: [{ key: "ciudad", filled: 13 }] });
  });

  it("borrar exige la clave, y otra cuenta no lo ve ni lo borra", async () => {
    const fields = services();
    const id = (await run(fields, "POST", "/contact-fields", "tenant_owner", "tenant-a", { label: "Ciudad", type: "text" })).body.id as string;
    expect((await run(fields, "GET", "/contact-fields", "tenant_owner", "tenant-b")).body.fields).toEqual([]);
    await expect(run(fields, "DELETE", `/contact-fields/${id}?confirm=ciudad`, "tenant_owner", "tenant-b")).rejects.toThrow(/ya no existe/);
    await expect(run(fields, "DELETE", `/contact-fields/${id}`, "tenant_owner")).rejects.toThrow(/escribe «ciudad»/);
    expect((await run(fields, "DELETE", `/contact-fields/${id}?confirm=ciudad`, "tenant_owner")).status).toBe(204);
  });

  it("la ficha: la ve quien ve contactos y la llena el Asesor; Solo lectura no la cambia; otra cuenta no la ve", async () => {
    const fields = services();
    await run(fields, "POST", "/contact-fields", "tenant_owner", "tenant-a", { label: "Presupuesto", type: "number" });
    await run(fields, "POST", "/contact-fields/adopt", "tenant_owner", "tenant-a", { fields: [{ key: "ciudad", label: "Ciudad", type: "list", options: ["Medellín", "Bogotá"] }] });

    expect(await run(fields, "GET", `/contact-fields/values/${LAURA}`, "viewer")).toMatchObject({ status: 200, body: { canEdit: false, values: { ciudad: "Medellín" } } });
    const saved = await run(fields, "PATCH", `/contact-fields/values/${LAURA}`, "operator", "tenant-a", { changes: { presupuesto: "1.200.000", ciudad: null } });
    expect(saved).toMatchObject({ status: 200, body: { canEdit: true, values: { presupuesto: 1200000, nota_interna: "x" }, origins: { presupuesto: { source: "team", actorName: "Ana" } } } });
    expect(saved.body.values).not.toHaveProperty("ciudad");

    await expect(run(fields, "PATCH", `/contact-fields/values/${LAURA}`, "viewer", "tenant-a", { changes: { presupuesto: 1 } })).rejects.toBeInstanceOf(AccessError);
    await expect(run(fields, "PATCH", `/contact-fields/values/${LAURA}`, "operator", "tenant-a", { changes: { presupuesto: "mucho" } })).rejects.toThrow("debe ser un número");
    await expect(run(fields, "PATCH", `/contact-fields/values/${LAURA}`, "operator", "tenant-a", { changes: { nota_interna: "y" } })).rejects.toThrow("no es un campo");
    await expect(run(fields, "GET", `/contact-fields/values/${LAURA}`, "tenant_owner", "tenant-b")).rejects.toThrow("no existe");
  });

  it("sin el módulo responde 503 y no toma otras rutas", async () => {
    expect((await run(undefined, "GET", "/contact-fields", "tenant_owner")).status).toBe(503);
    const r = res();
    expect(await routeContactFieldsRequest(req("GET", "/contacts"), r as never, new URL("http://x/contacts"), undefined, makeContext({ scopes: [], tenantId: "t", actorId: "u" }))).toBe(false);
  });
});
