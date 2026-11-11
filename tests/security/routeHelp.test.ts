import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeHelpRequest, type HelpRoutes } from "../../apps/api/routes/routeHelpRequest.js";
import { routeHelpDocs } from "../../apps/api/routes/routeHelpDocs.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Ayuda por HTTP: cualquier persona con sesión lee y abre casos; solo el
// equipo de Auream (`help.manage`, rol de plataforma) llega a administrar. La
// documentación pública (`/llms.txt`, `/help/docs/*.md`) no lleva sesión.
// ---------------------------------------------------------------------------

const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const req = (method: string, path: string, body?: unknown) => Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {} }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};
const module = () => ({
  help: { home: vi.fn(async () => ({})), module: vi.fn(async () => []), article: vi.fn(async () => ({})), search: vi.fn(async () => []), rate: vi.fn(async () => undefined) },
  tutorials: { forViewer: vi.fn(async () => []), save: vi.fn(async () => []), remove: vi.fn(async () => []), reorder: vi.fn(async () => []), markSeen: vi.fn(async () => undefined) },
  support: { settings: vi.fn(async () => ({})), mine: vi.fn(async () => []), open: vi.fn(async () => []), all: vi.fn(async () => []), reply: vi.fn(async () => undefined), saveSettings: vi.fn(async () => ({})) }
});

async function run(m: ReturnType<typeof module>, method: string, path: string, role: keyof typeof ROLE_SCOPES, body?: unknown) {
  const r = res();
  await routeHelpRequest(req(method, path, body), r as never, new URL(`http://x${path}`), m as unknown as HelpRoutes, makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId: "tenant-a", actorId: "user-a" }));
  return r.statusCode;
}

describe("Ayuda por HTTP", () => {
  it("todos leen, buscan, marcan vistos y abren casos", async () => {
    const m = module();
    expect(await run(m, "GET", "/help", "viewer")).toBe(200);
    expect(await run(m, "GET", "/help/articles/conectar-whatsapp-qr", "operator")).toBe(200);
    expect(await run(m, "GET", "/help/search?q=qr", "viewer")).toBe(200);
    expect(await run(m, "POST", `/help/tutorials/${ID}/seen`, "viewer")).toBe(204);
    expect(await run(m, "POST", "/help/support/cases", "operator", { message: "No me llega" })).toBe(201);
    expect(m.help.home).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-a", canManage: false });
  });

  it("solo el rol de plataforma llega con permiso de administrar (los servicios lo exigen)", async () => {
    const m = module();
    await run(m, "POST", "/help/tutorials", "tenant_owner", {});
    expect(m.tutorials.save).toHaveBeenCalledWith(expect.objectContaining({ canManage: false }), null, {});
    await run(m, "PUT", "/help/support/settings", "platform_admin", {});
    expect(m.support.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ canManage: true }), {});
    expect(ROLE_SCOPES.tenant_owner).not.toContain("help.manage");
  });

  it("la documentación pública: llms.txt y cada artículo en Markdown", async () => {
    const docs = { documents: async () => [{ slug: "guia-para-agentes", title: "Guía", summary: "Reglas", body: "Texto", agentsOnly: true, module: "primeros-pasos" }, { slug: "conectar-whatsapp-qr", title: "Conectar", summary: "QR", body: "Pasos", agentsOnly: false, module: "conexiones" }] };
    const go = async (path: string) => {
      const r = res();
      const handled = await routeHelpDocs(req("GET", path), r as never, new URL(`http://x${path}`), docs as never, "https://app.test/api/help/docs");
      return { handled, ...r };
    };
    const index = await go("/llms.txt");
    expect(index.body).toContain("## Para agentes de IA\n- [Guía](https://app.test/api/help/docs/guia-para-agentes.md): Reglas");
    expect(index.body).toContain("## Conexiones");
    expect((await go("/help/docs/conectar-whatsapp-qr.md")).body).toContain("# Conectar");
    expect((await go("/help/docs/nada.md")).statusCode).toBe(404);
    expect((await go("/help")).handled).toBe(false);
  });
});
