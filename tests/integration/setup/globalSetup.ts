import { requireTestDatabaseUrl } from "./requireTestDatabase.js";

/**
 * Setup global de los tests de integración.
 *
 * Se ejecuta antes que cualquier test y aborta la suite completa si el entorno
 * no es seguro, antes de abrir una sola conexión.
 */
export default function globalSetup(): void {
  const url = requireTestDatabaseUrl();
  const host = new URL(url.replace(/^postgres(ql)?:\/\//, "https://")).hostname;

  console.log(`[integration] destino verificado: ${host}`);
}
