import { NEON_TEST_COMPUTE_HOST } from "../../../config/neon-environments.mjs";

// ---------------------------------------------------------------------------
// Barrera de entorno para los tests que hablan con Neon Auth.
//
// Equivalente a `requireTestDatabase`, pero para el proveedor de identidad.
// Estos tests CREAN usuarios reales: ejecutarlos contra producción llenaría de
// cuentas de prueba el entorno de los clientes.
//
// La comprobación es por HOST real del endpoint, no por el nombre de la
// variable: una `TEST_NEON_AUTH_URL` mal configurada se detecta igual.
// ---------------------------------------------------------------------------

export class UnsafeTestAuthError extends Error {}

export function requireTestAuthUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env["TEST_NEON_AUTH_URL"];

  if (!url) {
    throw new UnsafeTestAuthError(
      "Los tests de autenticación requieren TEST_NEON_AUTH_URL. No hay fallback a NEON_AUTH_URL."
    );
  }

  let host: string;

  try {
    host = new URL(url).hostname;
  } catch {
    throw new UnsafeTestAuthError("TEST_NEON_AUTH_URL no es una URL válida.");
  }

  if (!host.startsWith(NEON_TEST_COMPUTE_HOST)) {
    throw new UnsafeTestAuthError(
      `TEST_NEON_AUTH_URL apunta a ${host}, que no es el endpoint de la rama test. Abortado.`
    );
  }

  return url;
}
