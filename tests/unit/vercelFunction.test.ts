import { afterEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// La función de Vercel (`api/index.ts`): quita el prefijo `/api`, sirve la
// MISMA API que el servidor local y, si falta configuración, responde 500 sin
// detalles.
// ---------------------------------------------------------------------------

function request(url: string, method = "GET") {
  return Object.assign(Readable.from([]), { url, method, headers: {} }) as unknown as IncomingMessage;
}

function response() {
  const res = { statusCode: 0, headers: {} as Record<string, string>, body: "", setHeader(k: string, v: string) { res.headers[k.toLowerCase()] = v; }, end(chunk?: string) { res.body = chunk ?? ""; } };
  return res;
}

const ENV = {
  NODE_ENV: "production",
  VERCEL: "1",
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  NEON_AUTH_URL: "https://auth.example.test",
  NEON_AUTH_ISSUER: "https://auth.example.test",
  CORS_ALLOWED_ORIGINS: "https://app.example.test",
  CREDENTIALS_ENCRYPTION_KEY: randomBytes(32).toString("base64")
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("stripApiPrefix", async () => {
  const { stripApiPrefix } = await import("../../api/index.js");
  it.each([
    ["/api/automations", "/automations"],
    ["/api/contacts?search=ana", "/contacts?search=ana"],
    ["/api/api/builder/flows/x/workspace", "/api/builder/flows/x/workspace"],
    ["/api", "/"],
    ["/api?x=1", "/?x=1"],
    ["/apix", "/apix"]
  ])("%s → %s", (input, expected) => {
    expect(stripApiPrefix(input)).toBe(expected);
  });
});

describe("handler", () => {
  it("sirve la API real: /api/health responde 200", async () => {
    for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
    const { default: handler } = await import("../../api/index.js");
    const res = response();
    await handler(request("/api/health"), res as unknown as ServerResponse);
    expect([res.statusCode, JSON.parse(res.body)]).toEqual([200, { status: "ok" }]);
  });

  it("sin configuración responde 500 genérico, sin detalles", async () => {
    for (const key of Object.keys(ENV)) vi.stubEnv(key, "");
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: handler } = await import("../../api/index.js");
    const res = response();
    await handler(request("/api/health"), res as unknown as ServerResponse);
    expect([res.statusCode, JSON.parse(res.body)]).toEqual([500, { message: "La API no está configurada correctamente." }]);
    expect(log).toHaveBeenCalled();
  });

  it("en Vercel usa un pool pequeño", async () => {
    const { loadDatabaseConfig } = await import("../../apps/api/config/loadDatabaseConfig.js");
    expect(loadDatabaseConfig({ DATABASE_URL: "postgres://x", VERCEL: "1" })).toMatchObject({ poolMax: 3 });
    expect(loadDatabaseConfig({ DATABASE_URL: "postgres://x" })).toMatchObject({ poolMax: 10 });
    expect(() => loadDatabaseConfig({ DATABASE_URL: "postgres://x", DATABASE_POOL_MAX: "0" })).toThrow(/DATABASE_POOL_MAX/);
  });
});
