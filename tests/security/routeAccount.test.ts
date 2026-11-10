import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeCompanyRequest } from "../../apps/api/routes/routeCompanyRequest.js";
import { routeMyProfileRequest } from "../../apps/api/routes/routeMyProfileRequest.js";
import type { CompanyServices } from "../../domains/company/application/CompanyServices.js";
import type { ProfileServices } from "../../domains/profiles/application/ProfileServices.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Empresa: todo el equipo la ve; solo los dueños (`tenant.manage`) la cambian,
// y siempre la de la cuenta del contexto. Mi perfil: siempre el de la propia
// identidad. Sin almacén de archivos, subir imágenes responde 503.
// ---------------------------------------------------------------------------

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {} }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

const companyServices = (canUploadLogos = true) => ({
  canUploadLogos,
  get: vi.fn(async (_tenantId: string, canEdit: boolean) => ({ name: "X", canEdit })),
  update: vi.fn(async () => ({})),
  logoTicket: vi.fn(async () => ({})),
  setLogo: vi.fn(async () => ({})),
  removeLogo: vi.fn(async () => ({}))
});

describe("routeCompanyRequest", () => {
  it("todo el equipo ve la empresa; `canEdit` solo con tenant.manage", async () => {
    const s = companyServices();
    const viewer = res();
    await routeCompanyRequest(req("GET", "/company"), viewer as never, new URL("http://x/company"), s as unknown as CompanyServices, makeContext({ scopes: ["flows.read"] }));
    expect(JSON.parse(viewer.body)).toEqual({ name: "X", canEdit: false });
    const owner = res();
    await routeCompanyRequest(req("GET", "/company"), owner as never, new URL("http://x/company"), s as unknown as CompanyServices, makeContext({ scopes: ["tenant.manage"] }));
    expect(JSON.parse(owner.body)).toEqual({ name: "X", canEdit: true });
  });

  it.each([
    ["PATCH", "/company"],
    ["POST", "/company/logo/uploads"],
    ["PUT", "/company/logo"],
    ["DELETE", "/company/logo"]
  ])("%s %s exige tenant.manage", async (method, path) => {
    const s = companyServices();
    await expect(routeCompanyRequest(req(method, path, {}), res() as never, new URL(`http://x${path}`), s as unknown as CompanyServices, makeContext({ scopes: ["flows.write", "credentials.write"] }))).rejects.toThrow(AccessError);
    expect(s.update).not.toHaveBeenCalled();
    expect(s.logoTicket).not.toHaveBeenCalled();
  });

  it("cambia la empresa del contexto, nunca la que diga la petición", async () => {
    const s = companyServices();
    await routeCompanyRequest(req("PATCH", "/company", { name: "Y", tenantId: "otra" }), res() as never, new URL("http://x/company"), s as unknown as CompanyServices, makeContext({ scopes: ["tenant.manage"] }));
    expect(s.update.mock.calls[0]?.[0]).toBe("test-tenant");
  });

  it("sin almacén de archivos, el logo responde 503", async () => {
    const r = res();
    await routeCompanyRequest(req("POST", "/company/logo/uploads", {}), r as never, new URL("http://x/company/logo/uploads"), companyServices(false) as unknown as CompanyServices, makeContext({ scopes: ["tenant.manage"] }));
    expect(r.statusCode).toBe(503);
  });

  it("no toca otras rutas", async () => {
    expect(await routeCompanyRequest(req("GET", "/contacts"), res() as never, new URL("http://x/contacts"), companyServices() as unknown as CompanyServices, makeContext())).toBe(false);
  });
});

describe("routeMyProfileRequest", () => {
  it("lee y cambia el perfil de la identidad que pregunta", async () => {
    const s = { canUploadPhotos: true, get: vi.fn(async () => ({})), update: vi.fn(async () => ({})) };
    await routeMyProfileRequest(req("GET", "/me/profile"), res() as never, new URL("http://x/me/profile"), s as unknown as ProfileServices, "user-1");
    await routeMyProfileRequest(req("PATCH", "/me/profile", { displayName: "Ana", userId: "otro" }), res() as never, new URL("http://x/me/profile"), s as unknown as ProfileServices, "user-1");
    expect(s.get.mock.calls[0]?.[0]).toBe("user-1");
    expect(s.update.mock.calls[0]?.[0]).toBe("user-1");
  });

  it("sin almacén de archivos, la foto responde 503", async () => {
    const r = res();
    await routeMyProfileRequest(req("POST", "/me/profile/photo/uploads", {}), r as never, new URL("http://x/me/profile/photo/uploads"), { canUploadPhotos: false } as unknown as ProfileServices, "user-1");
    expect(r.statusCode).toBe(503);
  });
});
