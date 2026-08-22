/**
 * API key de desarrollo local.
 *
 * Reglas:
 *  - NUNCA se hardcodea un valor: se lee de `VITE_DEV_API_KEY`.
 *  - La lectura está dentro de `import.meta.env.DEV`, por lo que en un build de
 *    producción la rama se elimina y la variable jamás queda en el bundle.
 *  - Si no está definida, no se envía cabecera de API key.
 *
 * Estado: PREPARADO. Sustituir por el token real de sesión cuando exista login.
 */
export function getDevApiKey(): string | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  return import.meta.env.VITE_DEV_API_KEY ?? null;
}
