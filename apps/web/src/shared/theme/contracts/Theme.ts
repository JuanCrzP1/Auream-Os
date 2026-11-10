/**
 * Contrato del tema visual de la aplicación.
 *
 * Responsabilidad única: definir los valores válidos de tema y su guarda de
 * tipos. Ningún módulo debe declarar el literal "dark" | "light" por su cuenta.
 *
 *   Theme            el tema que se pinta: claro u oscuro
 *   ThemePreference  lo que elige la persona: claro, oscuro o el del sistema
 *                    (sigue al equipo y cambia solo si el equipo cambia)
 */

export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/**
 * Tema con el que arranca la app mientras el usuario no elija otro.
 * La identidad del producto es oscura; el claro es una preferencia opcional.
 */
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Devuelve el tema opuesto. Usado por el toggle. */
export function oppositeTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** El tema que se pinta para una preferencia («sistema» sigue al equipo). */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}
