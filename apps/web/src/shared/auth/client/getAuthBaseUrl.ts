/**
 * URL base del servicio de identidad (Neon Auth) de este entorno.
 *
 * En producción es obligatoria: apuntar al endpoint equivocado significaría
 * autenticar contra otra rama de Neon.
 */
export function getAuthBaseUrl(): string {
  const configured = import.meta.env.VITE_NEON_AUTH_URL;

  if (configured) {
    return configured;
  }

  if (import.meta.env.DEV) {
    throw new Error(
      "VITE_NEON_AUTH_URL no está definido. Configúralo en apps/web/.env.local para iniciar sesión."
    );
  }

  throw new Error("VITE_NEON_AUTH_URL no está definido. Es obligatorio en builds de producción.");
}
