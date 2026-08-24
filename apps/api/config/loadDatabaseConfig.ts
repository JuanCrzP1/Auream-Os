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
}

export function loadDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const connectionString = env["DATABASE_URL"];

  if (!connectionString) {
    throw new ApiConfigError(
      "DATABASE_URL no está definido. La API no puede arrancar sin base de datos."
    );
  }

  return { connectionString };
}
