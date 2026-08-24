// ---------------------------------------------------------------------------
// resolveTargetDatabase
//
// Responsabilidad única: decidir contra qué base de datos actúa un script de
// operaciones (migraciones, seed) y negarse si el destino no es el esperado.
//
// Es el ÚNICO lugar del proyecto donde se toma esa decisión. `migrate.mjs` y
// `seed-dev.mjs` la importan; ninguno reimplementa la comparación de host.
//
// El host de producción y la comparación de URL vienen de
// `config/neon-environments.mjs` — fuente única, no redeclarada aquí.
//
// Regla por defecto: TEST. Actuar sobre producción exige una bandera explícita.
// ---------------------------------------------------------------------------

import { isProductionDatabaseUrl, parseDatabaseHost, safeHostOf } from "../../config/neon-environments.mjs";

export class UnsafeTargetError extends Error {}

/**
 * Resuelve el destino.
 *
 * @param {object} options
 * @param {boolean} options.allowProduction  true sólo si el operador pasó --confirm-production
 * @param {NodeJS.ProcessEnv} [options.env]
 * @returns {{ connectionString: string, target: "test" | "production", host: string }}
 */
export function resolveTargetDatabase({ allowProduction, env = process.env }) {
  if (allowProduction) {
    const url = env["DATABASE_URL"];

    if (!url) {
      throw new UnsafeTargetError("DATABASE_URL no está definido; no hay destino de producción.");
    }

    if (parseDatabaseHost(url) === null) {
      throw new UnsafeTargetError("DATABASE_URL no es una connection string válida. Abortado.");
    }

    if (!isProductionDatabaseUrl(url)) {
      throw new UnsafeTargetError(
        "--confirm-production se pasó pero DATABASE_URL no apunta a producción. Abortado por seguridad."
      );
    }

    return { connectionString: url, target: "production", host: safeHostOf(url) };
  }

  const url = env["TEST_DATABASE_URL"];

  if (!url) {
    throw new UnsafeTargetError(
      "TEST_DATABASE_URL no está definido. No existe fallback a DATABASE_URL: abortado."
    );
  }

  if (parseDatabaseHost(url) === null) {
    throw new UnsafeTargetError("TEST_DATABASE_URL no es una connection string válida. Abortado.");
  }

  if (isProductionDatabaseUrl(url)) {
    throw new UnsafeTargetError(
      "TEST_DATABASE_URL apunta a producción. Abortado: las operaciones de test nunca tocan producción."
    );
  }

  return { connectionString: url, target: "test", host: safeHostOf(url) };
}
