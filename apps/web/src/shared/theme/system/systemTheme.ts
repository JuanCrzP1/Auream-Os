import type { Theme } from "../contracts/Theme";

/**
 * Preferencia de tema del sistema operativo.
 *
 * Responsabilidad única: traducir `prefers-color-scheme` a nuestro contrato.
 * Es el valor por defecto cuando el usuario nunca ha elegido tema.
 */

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function getSystemTheme(): Theme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Avisa cuando el sistema cambia de tema. Devuelve la función de baja. */
export function subscribeToSystemTheme(listener: (theme: Theme) => void): () => void {
  try {
    const query = window.matchMedia(DARK_QUERY);
    const handle = (event: MediaQueryListEvent) => listener(event.matches ? "dark" : "light");

    query.addEventListener("change", handle);
    return () => query.removeEventListener("change", handle);
  } catch {
    return () => undefined;
  }
}
