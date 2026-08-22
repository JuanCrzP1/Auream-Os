import type { RateLimitPolicy } from "../contracts/RateLimitPolicy";
import type { RateLimitResult } from "../contracts/RateLimitResult";

export interface RateLimiter {
  check(key: string, policy: RateLimitPolicy): RateLimitResult;
}
