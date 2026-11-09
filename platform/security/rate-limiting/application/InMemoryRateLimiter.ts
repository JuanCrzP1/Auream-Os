import type { RateLimitPolicy } from "../contracts/RateLimitPolicy";
import type { RateLimitResult } from "../contracts/RateLimitResult";
import type { RateLimiter } from "./RateLimiter";

/** Una instancia, en memoria: desarrollo y pruebas (en producción, `SqlRateLimiter`). */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, number[]>();

  public async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - policy.windowMs;

    const timestamps = (this.windows.get(key) ?? []).filter(
      (t) => t > windowStart
    );

    if (timestamps.length >= policy.maxRequests) {
      const oldest = timestamps[0]!;
      const retryAfterMs = policy.windowMs - (now - oldest);
      this.windows.set(key, timestamps);
      return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
    }

    timestamps.push(now);
    this.windows.set(key, timestamps);
    return {
      allowed: true,
      remainingRequests: policy.maxRequests - timestamps.length,
    };
  }
}
