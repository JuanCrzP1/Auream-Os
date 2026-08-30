/**
 * Contrato del tema visual de la aplicación.
 *
 * Responsabilidad única: definir los valores válidos de tema y su guarda de
 * tipos. Ningún módulo debe declarar el literal "dark" | "light" por su cuenta.
 */

export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Devuelve el tema opuesto. Usado por el toggle. */
export function oppositeTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
