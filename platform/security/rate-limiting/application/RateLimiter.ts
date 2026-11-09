import type { RateLimitPolicy } from "../contracts/RateLimitPolicy";
import type { RateLimitResult } from "../contracts/RateLimitResult";

/**
 * Cuenta una petición contra su política. Asíncrono: en producción la cuenta
 * vive en Neon (`SqlRateLimiter`), compartida por todas las instancias de
 * Vercel; en desarrollo y pruebas, en memoria.
 */
export interface RateLimiter {
  check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult>;
}
