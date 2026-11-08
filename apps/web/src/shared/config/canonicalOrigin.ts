/**
 * Dirección oficial de la aplicación.
 *
 * Un despliegue de Vercel responde en varias direcciones: la oficial
 * (`auream-os.vercel.app` o el dominio propio) y otras técnicas (la del
 * propio despliegue, la del equipo, la de la rama). Neon Auth solo acepta
 * iniciar sesión desde la oficial, así que si alguien entra por otra se le
 * lleva a la oficial ANTES de pintar nada, conservando la ruta.
 *
 * La define el build de producción (`VITE_APP_URL`, desde el dominio de
 * producción de Vercel). En desarrollo y en vistas previas no existe: no se
 * redirige.
 */
export function canonicalRedirectTarget(
  location: Pick<Location, "origin" | "pathname" | "search" | "hash">,
  canonical: string | undefined
): string | null {
  if (!canonical) return null;
  let official: URL;
  try {
    official = new URL(canonical);
  } catch {
    return null;
  }
  if (location.origin === official.origin) return null;
  return `${official.origin}${location.pathname}${location.search}${location.hash}`;
}
