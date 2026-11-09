import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import type { RateLimitPolicy } from "../../platform/security/rate-limiting/contracts/RateLimitPolicy.js";

const POLICY: RateLimitPolicy = { windowMs: 1000, maxRequests: 3 };

describe("InMemoryRateLimiter", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  it("primera petición siempre está permitida", async () => {
    const result = await limiter.check("key-a", POLICY);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.remainingRequests).toBe(2);
    }
  });

  it("alcanzar el límite retorna denied con retryAfterMs > 0", async () => {
    await limiter.check("key-a", POLICY);
    await limiter.check("key-a", POLICY);
    await limiter.check("key-a", POLICY);
    const result = await limiter.check("key-a", POLICY);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("claves distintas son independientes", async () => {
    await limiter.check("key-a", POLICY);
    await limiter.check("key-a", POLICY);
    await limiter.check("key-a", POLICY);
    // key-b no ha sido usada aún
    const result = await limiter.check("key-b", POLICY);
    expect(result.allowed).toBe(true);
  });

  it("tras expirar la ventana permite nuevas peticiones", async () => {
    const shortPolicy: RateLimitPolicy = { windowMs: 50, maxRequests: 1 };
    await limiter.check("key-c", shortPolicy);
    const denied = await limiter.check("key-c", shortPolicy);
    expect(denied.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const allowed = await limiter.check("key-c", shortPolicy);
    expect(allowed.allowed).toBe(true);
  });

  it("remainingRequests disminuye con cada petición", async () => {
    const r1 = await limiter.check("key-d", POLICY);
    const r2 = await limiter.check("key-d", POLICY);
    const r3 = await limiter.check("key-d", POLICY);
    expect(r1.allowed && r1.remainingRequests).toBe(2);
    expect(r2.allowed && r2.remainingRequests).toBe(1);
    expect(r3.allowed && r3.remainingRequests).toBe(0);
  });
});
