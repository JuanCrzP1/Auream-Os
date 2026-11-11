import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeGroupsRequest, type GroupRoutes } from "../../apps/api/routes/routeGroupsRequest.js";
import { routeGroupLink } from "../../apps/api/routes/routeGroupLink.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Grupos por HTTP: todo el equipo ve campañas, grupos y resultados; crear,
// editar, sincronizar y enviar a grupos es de dueños y administradores. El
// enlace público no lleva sesión: manda al grupo o muestra una página corta.
// ---------------------------------------------------------------------------

const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {}, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};
const module = () => ({
  campaigns: { overview: vi.fn(async () => ({})), detail: vi.fn(async () => ({})), create: vi.fn(async () => ({})), update: vi.fn(async () => ({})), setOpen: vi.fn(async () => ({})) },
  groups: { list: vi.fn(async () => ({})), syncNow: vi.fn(async () => ({})), attach: vi.fn(async () => ({})) },
  posts: { create: vi.fn(async () => ({})), cancel: vi.fn(async () => []) }
});

async function run(m: ReturnType<typeof module>, method: string, path: string, role: keyof typeof ROLE_SCOPES, body?: unknown) {
  const r = res();
  await routeGroupsRequest(req(method, path, body), r as never, new URL(`http://x${path}`), m as unknown as GroupRoutes, makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId: "tenant-a" }));
  return r.statusCode;
}

describe("Grupos por HTTP", () => {
  it("todo el equipo ve; solo dueños y administradores cambian o envían", async () => {
    const m = module();
    for (const role of ["tenant_owner", "operator", "viewer"] as const) {
      expect(await run(m, "GET", "/groups", role)).toBe(200);
      expect(await run(m, "GET", "/groups/list", role)).toBe(200);
      expect(await run(m, "GET", `/groups/campaigns/${ID}`, role)).toBe(200);
    }
    expect(await run(m, "POST", "/groups/campaigns", "tenant_admin", { name: "X" })).toBe(201);
    expect(await run(m, "PUT", `/groups/campaigns/${ID}`, "tenant_admin", {})).toBe(200);
    expect(await run(m, "POST", `/groups/campaigns/${ID}/close`, "tenant_owner")).toBe(200);
    expect(m.campaigns.setOpen).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-a" }), ID, false);
    expect(await run(m, "POST", "/groups/sync", "tenant_owner")).toBe(200);
    expect(await run(m, "PATCH", `/groups/list/${ID}`, "tenant_owner", { campaignId: null })).toBe(200);
    expect(await run(m, "POST", "/groups/posts", "tenant_owner", {})).toBe(201);
    expect(await run(m, "POST", `/groups/posts/${ID}/cancel`, "tenant_owner")).toBe(200);
    for (const role of ["operator", "viewer"] as const) {
      await expect(run(m, "POST", "/groups/campaigns", role, {})).rejects.toBeInstanceOf(AccessError);
      await expect(run(m, "POST", "/groups/posts", role, {})).rejects.toBeInstanceOf(AccessError);
      await expect(run(m, "POST", "/groups/sync", role)).rejects.toBeInstanceOf(AccessError);
    }
  });

  it("el enlace público: al grupo, o una página corta si no existe o cerró", async () => {
    const link = { click: vi.fn(async (slug: string) => (slug === "navidad" ? { kind: "redirect" as const, url: "https://chat.whatsapp.com/abc" } : slug === "bfriday" ? { kind: "closed" as const } : { kind: "missing" as const })) };
    const go = async (path: string) => {
      const r = res();
      const handled = await routeGroupLink(req("GET", path), r as never, new URL(`http://x${path}`), link, undefined);
      return { handled, ...r };
    };
    expect(await go("/g/navidad?src=ig")).toMatchObject({ handled: true, statusCode: 302, headers: { Location: "https://chat.whatsapp.com/abc" } });
    expect(link.click).toHaveBeenCalledWith("navidad", "ig");
    const closed = await go("/g/bfriday");
    expect(closed.statusCode).toBe(410);
    expect(closed.body).toContain("Este grupo ya cerró");
    expect((await go("/g/nada")).statusCode).toBe(404);
    expect((await go("/groups")).handled).toBe(false);
  });
});
