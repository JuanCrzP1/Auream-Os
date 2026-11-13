import { loadTestEnv } from "../../integration/setup/loadTestEnv.js";
import { requireTestDatabaseUrl } from "../../integration/setup/requireTestDatabase.js";

/**
 * Antes de cualquier recorrido: carga `.env.test` y aborta si la base no es la
 * de PRUEBAS. Los recorridos no inician sesión (usan la clave de desarrollo),
 * así que no tocan el proveedor de identidad.
 */
export default function globalSetup(): void {
  loadTestEnv();
  const url = requireTestDatabaseUrl();
  const host = new URL(url.replace(/^postgres(ql)?:\/\//, "https://")).hostname;
  console.log(`[e2e] base de datos verificada: ${host}`);
}
