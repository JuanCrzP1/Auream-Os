import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeSalesRequest, type SalesRoutes } from "../../apps/api/routes/routeSalesRequest.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Ventas y Productos por HTTP: ver exige `sales.read`; anotar, `sales.write`
// (el Asesor); revisar, anular y tocar el catálogo, `sales.manage`. La cuenta
// y quien actúa salen SIEMPRE del contexto, nunca de la petición.
// ---------------------------------------------------------------------------

const ID = "aaaaaaaa-0000-4000-8000-000000000001";

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {}, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

const module = () => ({
  products: { list: vi.fn(async () => ({ products: [], canManage: false })), create: vi.fn(async () => ({ id: ID })), update: vi.fn(async () => ({ id: ID })) },
  sales: { list: vi.fn(async () => ({ sales: [] })), record: vi.fn(async () => ({ id: ID })), update: vi.fn(async () => ({ id: ID })) }
});

async function run(m: ReturnType<typeof module> | undefined, method: string, path: string, scopes: string[], body?: unknown) {
  const response = res();
  const handled = await routeSalesRequest(req(method, path, body), response as never, new URL(`http://x${path}`), m as unknown as SalesRoutes, makeContext({ scopes, tenantId: "tenant-a", actorId: "user-a" }));
  return { handled, status: response.statusCode };
}

describe("routeSalesRequest", () => {
  it("todo el equipo ve ventas y catálogo de SU cuenta; los filtros llegan de la dirección", async () => {
    const m = module();
    expect((await run(m, "GET", "/sales?status=review&from=2026-11-01&search=ana", ["sales.read"])).status).toBe(200);
    expect(m.sales.list).toHaveBeenCalledWith(
      { tenantId: "tenant-a", userId: "user-a", canRecord: false, canManage: false },
      expect.objectContaining({ status: "review", from: "2026-11-01", search: "ana" })
    );
    expect((await run(m, "GET", "/products", ["sales.read"])).status).toBe(200);
    expect(m.products.list).toHaveBeenCalledWith("tenant-a", false);
    await expect(run(m, "GET", "/sales", ["flows.read"])).rejects.toBeInstanceOf(AccessError);
  });

  it("anotar una venta exige sales.write (el Asesor la tiene)", async () => {
    const m = module();
    expect((await run(m, "POST", "/sales", ["sales.read", "sales.write"], { amount: 1 })).status).toBe(201);
    await expect(run(m, "POST", "/sales", ["sales.read"], { amount: 1 })).rejects.toBeInstanceOf(AccessError);
  });

  it("revisar o anular una venta y tocar el catálogo exigen sales.manage", async () => {
    const m = module();
    await expect(run(m, "PATCH", `/sales/${ID}`, ["sales.read", "sales.write"], { status: "void" })).rejects.toBeInstanceOf(AccessError);
    await expect(run(m, "POST", "/products", ["sales.read", "sales.write"], { name: "x" })).rejects.toBeInstanceOf(AccessError);
    expect((await run(m, "PATCH", `/sales/${ID}`, ["sales.manage"], { status: "void", voidReason: "falso" })).status).toBe(200);
    expect((await run(m, "POST", "/products", ["sales.manage"], { name: "x" })).status).toBe(201);
    expect((await run(m, "PATCH", `/products/${ID}`, ["sales.manage"], { name: "y" })).status).toBe(200);
    expect(m.products.create).toHaveBeenCalledWith("tenant-a", { name: "x" });
  });

  it("no toma otras rutas; sin el módulo responde 503", async () => {
    expect((await run(module(), "GET", "/salesforce", ["sales.read"])).handled).toBe(false);
    expect((await run(undefined, "GET", "/sales", ["sales.read"])).status).toBe(503);
  });
});
