import { ApiConfigError } from "./loadApiConfig";

// ---------------------------------------------------------------------------
// loadNeonAuthConfig
//
// Responsabilidad única: leer y validar la configuración del proveedor de
// identidad (Neon Auth) que este proceso acepta.
//
// `issuer` y `audience` son de UN solo entorno, nunca una lista: el proceso que
// sirve producción sólo acepta tokens de producción, y el que sirve test sólo
// acepta los de test. Es la barrera que impide reutilizar un token entre ramas,
// necesaria porque ambas ramas comparten la misma clave JWKS.
// ---------------------------------------------------------------------------

export interface NeonAuthConfig {
  /** URL base del servicio de autenticación (para el frontend y el /token). */
  readonly baseUrl: string;
  /** Emisor exigido en el claim `iss`. */
  readonly issuer: string;
  /** Audiencia exigida en el claim `aud`. */
  readonly audience: string;
  /** Endpoint del JWKS desde el que se obtienen las claves públicas. */
  readonly jwksUrl: string;
}

export function loadNeonAuthConfig(env: NodeJS.ProcessEnv = process.env): NeonAuthConfig {
  const baseUrl = env["NEON_AUTH_URL"];

  if (!baseUrl) {
    throw new ApiConfigError(
      "NEON_AUTH_URL no está definido. La API no puede verificar identidades sin proveedor."
    );
  }

  const issuer = env["NEON_AUTH_ISSUER"];

  if (!issuer) {
    throw new ApiConfigError(
      "NEON_AUTH_ISSUER no está definido. Sin issuer esperado, un token de otra rama sería aceptado."
    );
  }

  return {
    baseUrl,
    issuer,
    // La audiencia por defecto es el propio issuer: es lo que emite Neon Auth.
    audience: env["NEON_AUTH_AUDIENCE"] ?? issuer,
    jwksUrl: env["NEON_AUTH_JWKS_URL"] ?? `${baseUrl}/.well-known/jwks.json`
  };
}
