import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeLocalMediaRequest, routeMediaRequest } from "../../apps/api/routes/routeMediaRequest.js";
import type { MediaServices } from "../../apps/api/composition/composeMediaServices.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Subir medios exige flows.write; el tenant sale del contexto. Sin almacén,
// 503. Las rutas locales solo existen con el almacén local (desarrollo).
// ---------------------------------------------------------------------------

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {} }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};
const services = () => ({ createUpload: { execute: vi.fn(async () => ({ strategy: "direct" })) }, register: { execute: vi.fn(async () => ({ id: "m1" })) }, local: null });

describe("routeMediaRequest", () => {
  it.each(["/media/uploads", "/media"])("POST %s exige flows.write", async (path) => {
    const s = services();
    await expect(routeMediaRequest(req("POST", path, {}), res() as never, new URL(`http://x${path}`), s as unknown as MediaServices, makeContext({ scopes: ["flows.read"] }))).rejects.toThrow(AccessError);
    expect(s.createUpload.execute).not.toHaveBeenCalled();
    expect(s.register.execute).not.toHaveBeenCalled();
  });

  it("usa el tenant del contexto, nunca el de la petición", async () => {
    const s = services();
    await routeMediaRequest(req("POST", "/media/uploads", { kind: "image", tenantId: "otro" }), res() as never, new URL("http://x/media/uploads"), s as unknown as MediaServices, makeContext({ scopes: ["flows.write"] }));
    expect(s.createUpload.execute.mock.calls[0]?.[0]).toBe("test-tenant");
  });

  it("sin almacén de archivos responde 503", async () => {
    const r = res();
    await routeMediaRequest(req("POST", "/media/uploads", {}), r as never, new URL("http://x/media/uploads"), null, makeContext({ scopes: ["flows.write"] }));
    expect(r.statusCode).toBe(503);
  });

  it("las rutas locales no existen sin almacén local (nube o producción)", async () => {
    expect(await routeLocalMediaRequest(req("GET", "/media/local/files/x"), res() as never, new URL("http://x/media/local/files/x"), services() as unknown as MediaServices)).toBe(false);
  });
});
