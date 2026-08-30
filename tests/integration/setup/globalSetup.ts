import { loadTestEnv } from "./loadTestEnv.js";
import { requireTestDatabaseUrl } from "./requireTestDatabase.js";
import { requireTestAuthUrl } from "./requireTestAuth.js";

/**
 * Setup global de los tests de integración.
 *
 * Se ejecuta antes que cualquier test: carga `.env.test` y aborta la suite
 * completa si el entorno no es seguro, antes de abrir una sola conexión o
 * crear un solo usuario.
 *
 * Verifica los DOS destinos, base de datos y proveedor de identidad, porque la
 * suite escribe en ambos.
 */
export default function globalSetup(): void {
  loadTestEnv();

  const url = requireTestDatabaseUrl();
  const host = new URL(url.replace(/^postgres(ql)?:\/\//, "https://")).hostname;
  const authHost = new URL(requireTestAuthUrl()).hostname;

  console.log(`[integration] base de datos verificada: ${host}`);
  console.log(`[integration] identidad verificada: ${authHost}`);
}
