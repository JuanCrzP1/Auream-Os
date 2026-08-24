/**
 * API key de desarrollo local.
 *
 * Fallback deliberado y permanente: `builderApiClient` prefiere siempre el JWT
 * de una sesión real; esto sólo se envía cuando no hay sesión, para poder
 * trabajar en local sin iniciar sesión cada vez. No es un sustituto temporal
 * del login — coexiste con él.
 *
 * Reglas:
 *  - NUNCA se hardcodea un valor: se lee de `VITE_DEV_API_KEY`.
 *  - La lectura está dentro de `import.meta.env.DEV`, por lo que en un build de
 *    producción la rama se elimina y la variable jamás queda en el bundle.
 *  - Si no está definida, no se envía cabecera de API key.
 */
export function getDevApiKey(): string | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  return import.meta.env.VITE_DEV_API_KEY ?? null;
}
