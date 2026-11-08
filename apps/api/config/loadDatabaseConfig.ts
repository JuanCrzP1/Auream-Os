import { ApiConfigError } from "./loadApiConfig";

// ---------------------------------------------------------------------------
// loadDatabaseConfig
//
// Responsabilidad única: leer y validar la conexión a PostgreSQL de la API.
//
// La API SIEMPRE usa `DATABASE_URL`. Nunca lee `TEST_DATABASE_URL`: los tests
// tienen su propio camino y no comparten configuración con el proceso servidor.
// ---------------------------------------------------------------------------

export interface DatabaseConfig {
  readonly connectionString: string;
  /** Conexiones máximas del pool por proceso. */
  readonly poolMax: number;
  /** Cuánto vive una conexión ociosa antes de cerrarse (ms). */
  readonly idleTimeoutMs: number;
}

/**
 * En Vercel cada instancia de función es un proceso efímero: pocas conexiones
 * y que se suelten rápido (el endpoint `-pooler` de Neon absorbe el resto).
 * En un servidor de larga duración, un pool normal.
 */
const SERVERLESS_POOL = { poolMax: 3, idleTimeoutMs: 10_000 };
const SERVER_POOL = { poolMax: 10, idleTimeoutMs: 30_000 };

export function loadDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const connectionString = env["DATABASE_URL"];

  if (!connectionString) {
    throw new ApiConfigError(
      "DATABASE_URL no está definido. La API no puede arrancar sin base de datos."
    );
  }

  const defaults = env["VERCEL"] ? SERVERLESS_POOL : SERVER_POOL;
  const poolMax = Number(env["DATABASE_POOL_MAX"] ?? defaults.poolMax);
  if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 50) {
    throw new ApiConfigError("DATABASE_POOL_MAX debe ser un entero entre 1 y 50.");
  }

  return { connectionString, poolMax, idleTimeoutMs: defaults.idleTimeoutMs };
}
