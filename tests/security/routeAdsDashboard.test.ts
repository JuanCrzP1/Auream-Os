import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeAdsRequest } from "../../apps/api/routes/routeAdsRequest.js";
import { routeAdsCallback } from "../../apps/api/routes/routeAdsCallback.js";
import { routeDashboardRequest } from "../../apps/api/routes/routeDashboardRequest.js";
import type { AdConnectionServices } from "../../domains/ads/application/AdConnectionServices.js";
import type { DashboardModule } from "../../apps/api/composition/composeAdsServices.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Meta Ads y el Dashboard por HTTP: el gasto, el ROAS y la conexión con Meta
// son de dueños y administradores (`ads.*`); Ventas y Atención del Dashboard
// las ve todo el equipo (sin el dinero de anuncios). La vuelta de Meta no
// trae sesión: solo el `state` firmado decide la cuenta.
// ---------------------------------------------------------------------------

const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {}, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", headers: {} as Record<string, string>, setHeader(k: string, v: string) { r.headers[k] = v; }, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

const ads = () => ({
  status: vi.fn(async () => ({ accounts: [] })),
  startOAuth: vi.fn(() => ({ url: "https://meta" })),
  connectWithToken: vi.fn(async () => ({})),
  setEnabled: vi.fn(async () => ({})),
  syncNow: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  completeOAuth: vi.fn(async () => "tenant-a")
});
const dashboard = () => ({ sales: { overview: vi.fn(async () => ({})) }, ads: { performance: vi.fn(async () => ({})) }, repeat: { repeat: vi.fn(async () => ({})) }, attention: { overview: vi.fn(async () => ({})) }, lines: { compare: vi.fn(async () => ({})) },
  export: { export: vi.fn(async () => ({ name: "ventas_2026-10-01_a_2026-10-31", columns: ["Cliente", "Monto"], rows: [["=cmd", 1.5]], truncated: false, currency: "COP", missingRates: [] })) } });
const ctx = (role: keyof typeof ROLE_SCOPES) => makeContext({ scopes: [...ROLE_SCOPES[role]], tenantId: "tenant-a", actorId: "user-a" });

async function runAds(m: ReturnType<typeof ads>, method: string, path: string, role: keyof typeof ROLE_SCOPES, body?: unknown) {
  const r = res();
  await routeAdsRequest(req(method, path, body), r as never, new URL(`http://x${path}`), m as unknown as AdConnectionServices, ctx(role));
  return r.statusCode;
}

async function runDashboard(m: ReturnType<typeof dashboard>, path: string, role: keyof typeof ROLE_SCOPES) {
  return (await runDashboardFull(m, path, role)).statusCode;
}

async function runDashboardFull(m: ReturnType<typeof dashboard>, path: string, role: keyof typeof ROLE_SCOPES) {
  const r = res();
  await routeDashboardRequest(req("GET", path), r as never, new URL(`http://x${path}`), m as unknown as DashboardModule, ctx(role));
  return r;
}

describe("Meta Ads", () => {
  it("ver y conectar Meta es de dueños y administradores; el Asesor y Solo lectura no", async () => {
    const m = ads();
    expect(await runAds(m, "GET", "/ads/accounts", "tenant_admin")).toBe(200);
    expect(await runAds(m, "POST", "/ads/meta/token", "tenant_owner", { accessToken: "EAAB" })).toBe(200);
    expect(m.connectWithToken).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-a", canManage: true }, "EAAB");
    expect(await runAds(m, "PATCH", `/ads/accounts/${ID}`, "tenant_admin", { enabled: true })).toBe(200);
    expect(await runAds(m, "POST", `/ads/accounts/${ID}/sync`, "tenant_admin")).toBe(202);
    expect(await runAds(m, "DELETE", "/ads/connection", "tenant_owner")).toBe(204);
    await expect(runAds(m, "GET", "/ads/accounts", "operator")).rejects.toBeInstanceOf(AccessError);
    await expect(runAds(m, "POST", "/ads/meta/oauth", "viewer")).rejects.toBeInstanceOf(AccessError);
  });

  it("la vuelta de Meta manda a Meta Ads con el resultado y nunca con datos del token", async () => {
    const m = ads();
    const ok = res();
    await routeAdsCallback(req("GET", "/ads/meta/callback?code=c&state=s"), ok as never, new URL("http://x/ads/meta/callback?code=c&state=s"), m as unknown as AdConnectionServices, "https://app", undefined);
    expect(m.completeOAuth).toHaveBeenCalledWith("c", "s");
    expect([ok.statusCode, ok.headers["Location"]]).toEqual([302, "https://app/meta-ads?tab=accounts&meta=connected"]);
    m.completeOAuth.mockRejectedValueOnce(new Error("El inicio de sesión con Meta venció o no es válido."));
    const bad = res();
    await routeAdsCallback(req("GET", "/ads/meta/callback?code=c&state=x"), bad as never, new URL("http://x/ads/meta/callback?code=c&state=x"), m as unknown as AdConnectionServices, "https://app", undefined);
    expect(bad.headers["Location"]).toContain("meta=error&reason=El%20inicio");
    const denied = res();
    await routeAdsCallback(req("GET", "/ads/meta/callback?error=access_denied"), denied as never, new URL("http://x/ads/meta/callback?error=access_denied"), m as unknown as AdConnectionServices, "https://app", undefined);
    expect(denied.headers["Location"]).toBe("https://app/meta-ads?tab=accounts&meta=error&reason=denied");
  });
});

describe("Dashboard", () => {
  it("Ventas y Atención para todo el equipo; el gasto solo si tiene ads.read", async () => {
    const m = dashboard();
    expect(await runDashboard(m, "/dashboard/sales?from=2026-11-01&to=2026-11-10", "operator")).toBe(200);
    expect(m.sales.overview).toHaveBeenLastCalledWith({ tenantId: "tenant-a", canSeeAds: false, canExport: false }, { from: "2026-11-01", to: "2026-11-10", connectionId: undefined, productId: undefined });
    expect(await runDashboard(m, "/dashboard/sales", "tenant_owner")).toBe(200);
    expect(m.sales.overview).toHaveBeenLastCalledWith({ tenantId: "tenant-a", canSeeAds: true, canExport: true }, expect.anything());
    expect(await runDashboard(m, "/dashboard/attention", "viewer")).toBe(200);
    expect(await runDashboard(m, "/dashboard/ads?level=ad", "tenant_admin")).toBe(200);
    expect(m.ads.performance).toHaveBeenCalledWith("tenant-a", expect.anything(), "ad");
    await expect(runDashboard(m, "/dashboard/ads", "operator")).rejects.toBeInstanceOf(AccessError);
  });

  it("Con recompras: es gasto de anuncios, así que solo con ads.read; pasa el nivel y la ventana", async () => {
    const m = dashboard();
    expect(await runDashboard(m, "/dashboard/ads/repeat?from=2026-10-01&to=2026-10-31&level=ad&window=90", "tenant_admin")).toBe(200);
    expect(m.repeat.repeat).toHaveBeenCalledWith("tenant-a", expect.objectContaining({ from: "2026-10-01", to: "2026-10-31" }), "ad", "90");
    await expect(runDashboard(m, "/dashboard/ads/repeat", "operator")).rejects.toBeInstanceOf(AccessError);
    await expect(runDashboard(m, "/dashboard/ads/repeat", "viewer")).rejects.toBeInstanceOf(AccessError);
  });

  it("Descargar ventas: trae teléfonos, así que solo dueños y administradores; CSV sin caché y sin fórmulas", async () => {
    const m = dashboard();
    await expect(runDashboard(m, "/dashboard/sales/export", "operator")).rejects.toBeInstanceOf(AccessError);
    await expect(runDashboard(m, "/dashboard/sales/export", "viewer")).rejects.toBeInstanceOf(AccessError);
    expect(m.export.export).not.toHaveBeenCalled();
    const r = await runDashboardFull(m, "/dashboard/sales/export?from=2026-10-01&to=2026-10-31&line=l1", "tenant_admin");
    expect(r.statusCode).toBe(200);
    expect(m.export.export).toHaveBeenCalledWith("tenant-a", expect.objectContaining({ from: "2026-10-01", to: "2026-10-31", lineId: "l1" }));
    expect(r.headers).toMatchObject({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ventas_2026-10-01_a_2026-10-31.csv"', "Cache-Control": "no-store", "X-Export-Rows": "1", "X-Export-Truncated": "false" });
    expect(r.body).toBe("\uFEFFCliente;Monto\r\n'=cmd;1,5\r\n");
  });

  it("Comparar líneas: lo ve todo el equipo; el gasto y la ganancia, solo con ads.read; solo pasa periodo y moneda", async () => {
    const m = dashboard();
    expect(await runDashboard(m, "/dashboard/lines?from=2026-10-01&to=2026-10-31&currency=USD&line=x&productIds=p", "operator")).toBe(200);
    expect(m.lines.compare).toHaveBeenLastCalledWith({ tenantId: "tenant-a", canSeeAds: false }, { from: "2026-10-01", to: "2026-10-31", currency: "USD" });
    expect(await runDashboard(m, "/dashboard/lines", "tenant_owner")).toBe(200);
    expect(m.lines.compare).toHaveBeenLastCalledWith({ tenantId: "tenant-a", canSeeAds: true }, { from: undefined, to: undefined, currency: undefined });
  });
});
