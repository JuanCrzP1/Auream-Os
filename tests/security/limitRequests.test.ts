import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import { clientIp, enforceRateLimit, TENANT_API_POLICY } from "../../apps/api/middleware/limitRequests.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import { TooManyRequestsError } from "../../platform/observability/errors/TooManyRequestsError.js";
import { SqlRateLimiter } from "../../infrastructure/persistence/sql/SqlRateLimiter.js";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";

// Límite de peticiones a la entrada de la API: por cuenta con sesión válida,
// por IP solo los intentos sin sesión; 429 con cuánto esperar.

const request = (headers: Record<string, string>, remoteAddress = "10.0.0.9") => ({ headers, socket: { remoteAddress } }) as unknown as IncomingMessage;

describe("límite de peticiones de la API", () => {
  it("la IP del cliente: la primera de x-forwarded-for (Vercel), si no x-real-ip, si no la conexión", () => {
    expect(clientIp(request({ "x-forwarded-for": "190.85.1.2, 76.76.21.21" }))).toBe("190.85.1.2");
    expect(clientIp(request({ "x-real-ip": "190.85.1.3" }))).toBe("190.85.1.3");
    expect(clientIp(request({}))).toBe("10.0.0.9");
  });

  it("al pasar el límite responde 429 con cuánto esperar; sin limitador (pruebas) no limita", async () => {
    const limiter = new InMemoryRateLimiter();
    const policy = { windowMs: 60_000, maxRequests: 2 };
    await enforceRateLimit(limiter, "api:tenant:t1", policy);
    await enforceRateLimit(limiter, "api:tenant:t1", policy);
    const error = await enforceRateLimit(limiter, "api:tenant:t1", policy).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TooManyRequestsError);
    expect((error as TooManyRequestsError).retryAfterMs).toBeGreaterThan(0);
    await expect(enforceRateLimit(undefined, "api:tenant:t1", TENANT_API_POLICY)).resolves.toBeUndefined();
  });

  it("si la base del contador falla, deja pasar y lo avisa (un tropiezo no tumba la API)", async () => {
    const onError = vi.fn();
    const broken = { query: async () => { throw new Error("Neon no responde"); } } as unknown as SqlClient;
    await expect(enforceRateLimit(new SqlRateLimiter(broken, undefined, onError), "api:tenant:t1", { windowMs: 60_000, maxRequests: 1 })).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Neon no responde" }));
  });
});
