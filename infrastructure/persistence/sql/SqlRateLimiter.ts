import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import type { RateLimitResult } from "../../../platform/security/rate-limiting/contracts/RateLimitResult";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// Límite de peticiones en Neon (`022_rate_limits.sql`): la cuenta es la MISMA
// para todas las instancias de Vercel (en memoria, cada una contaría aparte y
// se reiniciaría al arrancar).
//
// Ventana fija: contar es una sola sentencia atómica (insertar o sumar 1 y
// devolver el total), así dos peticiones a la vez nunca se cuentan como una.
// Cada tanto borra las ventanas viejas.
//
// Si la base falla, DEJA PASAR (y lo avisa): un tropiezo de la base no debe
// tumbar la API. El límite protege; no es la puerta.
// ---------------------------------------------------------------------------

/** Cada cuántas cuentas se barren las ventanas viejas (por instancia). */
const SWEEP_EVERY = 500;
/** Ventanas más viejas que esto se borran (más que la ventana más larga en uso). */
const KEEP_MS = 60 * 60_000;

export class SqlRateLimiter implements RateLimiter {
  private counted = 0;

  public constructor(
    private readonly sql: SqlClient,
    private readonly now: () => number = () => Date.now(),
    private readonly onError: (error: unknown) => void = () => undefined
  ) {}

  public async check(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const now = this.now();
    const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
    try {
      const result = await this.sql.query<{ hits: number }>(
        `insert into rate_limit_counters (key, window_start, hits) values ($1, $2, 1)
         on conflict (key, window_start) do update set hits = rate_limit_counters.hits + 1
         returning hits`,
        [key.slice(0, 200), new Date(windowStart).toISOString()]
      );
      this.sweepSometimes(now);
      const hits = Number(result.rows[0]?.hits ?? 1);
      return hits <= policy.maxRequests
        ? { allowed: true, remainingRequests: policy.maxRequests - hits }
        : { allowed: false, retryAfterMs: Math.max(0, windowStart + policy.windowMs - now) };
    } catch (error) {
      this.onError(error);
      return { allowed: true, remainingRequests: 0 };
    }
  }

  private sweepSometimes(now: number): void {
    this.counted += 1;
    if (this.counted % SWEEP_EVERY !== 0) return;
    void this.sql
      .query("delete from rate_limit_counters where window_start < $1", [new Date(now - KEEP_MS).toISOString()])
      .catch((error: unknown) => this.onError(error));
  }
}
