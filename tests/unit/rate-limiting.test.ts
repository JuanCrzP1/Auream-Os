import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import type { RateLimitPolicy } from "../../platform/security/rate-limiting/contracts/RateLimitPolicy.js";

const POLICY: RateLimitPolicy = { windowMs: 1000, maxRequests: 3 };

describe("InMemoryRateLimiter", () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
  });

  it("primera petición siempre está permitida", () => {
    const result = limiter.check("key-a", POLICY);
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.remainingRequests).toBe(2);
    }
  });

  it("alcanzar el límite retorna denied con retryAfterMs > 0", () => {
    limiter.check("key-a", POLICY);
    limiter.check("key-a", POLICY);
    limiter.check("key-a", POLICY);
    const result = limiter.check("key-a", POLICY);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("claves distintas son independientes", () => {
    limiter.check("key-a", POLICY);
    limiter.check("key-a", POLICY);
    limiter.check("key-a", POLICY);
    // key-b no ha sido usada aún
    const result = limiter.check("key-b", POLICY);
    expect(result.allowed).toBe(true);
  });

  it("tras expirar la ventana permite nuevas peticiones", async () => {
    const shortPolicy: RateLimitPolicy = { windowMs: 50, maxRequests: 1 };
    limiter.check("key-c", shortPolicy);
    const denied = limiter.check("key-c", shortPolicy);
    expect(denied.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const allowed = limiter.check("key-c", shortPolicy);
    expect(allowed.allowed).toBe(true);
  });

  it("remainingRequests disminuye con cada petición", () => {
    const r1 = limiter.check("key-d", POLICY);
    const r2 = limiter.check("key-d", POLICY);
    const r3 = limiter.check("key-d", POLICY);
    expect(r1.allowed && r1.remainingRequests).toBe(2);
    expect(r2.allowed && r2.remainingRequests).toBe(1);
    expect(r3.allowed && r3.remainingRequests).toBe(0);
  });
});
