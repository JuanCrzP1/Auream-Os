/**
 * URL base de la API.
 *
 * En desarrollo cae a localhost si no se configura nada. En producción es
 * obligatorio definir `VITE_API_BASE_URL`: fallar es preferible a apuntar a
 * localhost desde un despliegue real.
 */
export function getBuilderApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;

  if (configured) {
    return configured;
  }

  if (import.meta.env.DEV) {
    return "http://localhost:3100";
  }

  throw new Error("VITE_API_BASE_URL no está definido. Es obligatorio en builds de producción.");
}
