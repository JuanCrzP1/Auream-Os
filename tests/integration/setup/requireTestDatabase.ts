import { isProductionDatabaseUrl, parseDatabaseHost } from "../../../config/neon-environments.mjs";

// ---------------------------------------------------------------------------
// Barrera de entorno para los tests de integración.
//
// Tres garantías, todas obligatorias:
//   1. Sin TEST_DATABASE_URL no se ejecuta nada. No hay fallback a DATABASE_URL.
//   2. Si TEST_DATABASE_URL no es una connection string legible, se aborta:
//      una URL inválida no es "segura" sólo porque no sea producción.
//   3. Si TEST_DATABASE_URL apunta a producción, se aborta: la comprobación
//      es por HOST real, no por el nombre de la variable.
// ---------------------------------------------------------------------------

export class UnsafeTestEnvironmentError extends Error {}

export function requireTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env["TEST_DATABASE_URL"];

  if (!url) {
    throw new UnsafeTestEnvironmentError(
      "Integration tests require TEST_DATABASE_URL. Refusing to run."
    );
  }

  if (parseDatabaseHost(url) === null) {
    throw new UnsafeTestEnvironmentError("TEST_DATABASE_URL is not a valid connection string.");
  }

  if (isProductionDatabaseUrl(url)) {
    throw new UnsafeTestEnvironmentError("Integration tests cannot run against production.");
  }

  return url;
}
