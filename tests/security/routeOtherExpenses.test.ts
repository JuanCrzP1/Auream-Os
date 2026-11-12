import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeOtherExpensesRequest } from "../../apps/api/routes/routeOtherExpensesRequest.js";
import { OtherExpenseServices } from "../../domains/expenses/application/OtherExpenseServices.js";
import { InMemoryOtherExpenseRepository } from "../../infrastructure/persistence/memory/InMemoryOtherExpenseRepository.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Otros gastos por HTTP: los ve quien ve el gasto en anuncios (dueños y
// administradores; con la ganancia se deducirían) y los cambian quienes
// manejan el catálogo. Cada cuenta solo toca los suyos.
// ---------------------------------------------------------------------------

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: { "content-type": "application/json" }, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

async function run(services: OtherExpenseServices | undefined, method: string, path: string, role: keyof typeof ROLE_SCOPES, tenantId = "tenant-a", body?: unknown) {
  const r = res();
  await routeOtherExpensesRequest(req(method, path, body), r as never, new URL(`http://x${path}`), services, makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId, actorId: "user-a" }));
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null };
}

const gasto = { name: "Nómina", kind: "fixed", amount: "1.000.000", currency: "COP", frequency: "monthly", startsOn: "2026-11-01" };

describe("/other-expenses", () => {
  it("dueños y administradores los ven y los manejan; el Asesor y Solo lectura no", async () => {
    let n = 0;
    const services = new OtherExpenseServices(new InMemoryOtherExpenseRepository(), () => `aaaaaaaa-0000-4000-8000-00000000000${++n}`);
    const created = await run(services, "POST", "/other-expenses", "tenant_owner", "tenant-a", gasto);
    expect(created).toMatchObject({ status: 201, body: { name: "Nómina", amount: 1_000_000 } });
    const id = created.body.id as string;

    expect(await run(services, "GET", "/other-expenses", "tenant_admin")).toMatchObject({ status: 200, body: { canManage: true, expenses: [{ id }] } });
    expect(await run(services, "PATCH", `/other-expenses/${id}`, "tenant_admin", "tenant-a", { amount: 900000 })).toMatchObject({ status: 200, body: { amount: 900_000 } });
    await expect(run(services, "GET", "/other-expenses", "operator")).rejects.toBeInstanceOf(AccessError);
    await expect(run(services, "POST", "/other-expenses", "viewer", "tenant-a", gasto)).rejects.toBeInstanceOf(AccessError);

    // Otra cuenta no ve ni borra el gasto.
    expect((await run(services, "GET", "/other-expenses", "tenant_owner", "tenant-b")).body.expenses).toEqual([]);
    await expect(run(services, "DELETE", `/other-expenses/${id}`, "tenant_owner", "tenant-b")).rejects.toThrow(/no existe/);
    expect((await run(services, "DELETE", `/other-expenses/${id}`, "tenant_owner")).status).toBe(204);
  });

  it("sin el módulo responde 503 y no toma otras rutas", async () => {
    expect((await run(undefined, "GET", "/other-expenses", "tenant_owner")).status).toBe(503);
    const r = res();
    expect(await routeOtherExpensesRequest(req("GET", "/sales-lines"), r as never, new URL("http://x/sales-lines"), undefined, makeContext({ scopes: [], tenantId: "t", actorId: "u" }))).toBe(false);
  });
});
