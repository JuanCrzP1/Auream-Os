import type { Theme } from "../contracts/Theme";

/**
 * Aplicación del tema al documento.
 *
 * Responsabilidad única: ser el ÚNICO punto que escribe en el DOM el tema
 * activo. Todo el CSS de la app cuelga de `:root[data-theme="..."]`, definido
 * en `shared/styles/theme.css`.
 *
 * `color-scheme` hace que los controles nativos (scrollbars, inputs, date
 * pickers) acompañen al tema sin CSS adicional.
 */

export function applyThemeToDocument(theme: Theme): void {
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
