import type { IncomingMessage } from "node:http";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import { TooManyRequestsError } from "../../../platform/observability/errors/TooManyRequestsError";

// ---------------------------------------------------------------------------
// Límite de peticiones a la entrada de la API (la cuenta, en Neon:
// `SqlRateLimiter`). Responde 429 con `Retry-After` (lo pone el listener).
//
//   por cuenta    con sesión válida: holgado para varios asesores con
//                 Conversaciones abiertas (consultan cada 1,5–4 s)
//   por IP        solo los intentos SIN sesión válida (credenciales falsas)
//
// No se limitan los avisos de WhatsApp (todos los de uazapi llegan desde la
// misma IP: cortarlos perdería mensajes de clientes) ni el trabajador de la
// cola (lo protege `CRON_SECRET`).
// ---------------------------------------------------------------------------

export const TENANT_API_POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 1_200 };
export const UNAUTHENTICATED_POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 300 };

const TOO_MANY = "Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.";

/** IP del cliente. En Vercel, la primera de `x-forwarded-for` (la pone Vercel). */
export function clientIp(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  const realIp = request.headers["x-real-ip"];
  return first || (Array.isArray(realIp) ? realIp[0] : realIp)?.trim() || request.socket?.remoteAddress || "desconocida";
}

/** Cuenta la petición; si pasa el límite, lanza `TooManyRequestsError` (429). */
export async function enforceRateLimit(limiter: RateLimiter | undefined, key: string, policy: RateLimitPolicy): Promise<void> {
  if (!limiter) return;
  const result = await limiter.check(key, policy);
  if (!result.allowed) throw new TooManyRequestsError(TOO_MANY, result.retryAfterMs);
}
