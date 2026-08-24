import { createSqlClient, type SqlClient } from "../../../infrastructure/persistence/sql/SqlClient.js";
import { requireTestDatabaseUrl } from "./requireTestDatabase.js";

/**
 * Cliente SQL para tests de integración.
 *
 * Pasa siempre por `requireTestDatabaseUrl`, de modo que ningún test puede
 * abrir una conexión sin haber superado la barrera de entorno.
 */
export function createTestSqlClient(): SqlClient {
  return createSqlClient(requireTestDatabaseUrl());
}

/** Prefijo de las claves de tenant creadas por tests, para poder limpiarlas. */
export const TEST_KEY_PREFIX = "it-";

/** Borra los datos que crea la suite. Los tenants arrastran sus memberships. */
export async function cleanupTestData(sql: SqlClient): Promise<void> {
  await sql.query("delete from tenants where key like $1", [TEST_KEY_PREFIX + "%"]);
}
