import { createHmac } from "node:crypto";

/**
 * Utilidades para generar JWTs de prueba firmados con HMAC-SHA256.
 * Responsabilidad única: construir tokens y payloads válidos o manipulados.
 */

export const TEST_SECRET = "test-secret-at-least-32-characters-long!!";

export function b64url(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function signJwt(payload: Record<string, unknown>, secret: string = TEST_SECRET): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `${header}.${body}.${sig}`;
}

export function makeValidPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: "actor-123",
    tenant: "test-tenant",
    scopes: ["builder:read", "builder:write"],
    iat: now,
    exp: now + 3600,
    ...overrides
  };
}
