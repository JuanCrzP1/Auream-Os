import { isTheme, type Theme } from "../contracts/Theme";

/**
 * Preferencia de tema elegida explícitamente por el usuario.
 *
 * Responsabilidad única: persistir esa elección entre recargas.
 * Ausencia de valor NO es un error: significa "seguir al sistema operativo".
 *
 * IMPORTANTE: la clave está duplicada en el script anti-parpadeo de
 * `apps/web/index.html`. Si se cambia aquí, cambiarla también allí.
 */

const STORAGE_KEY = "bots-ai-theme";

export const themeStore = {
  read(): Theme | null {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return isTheme(stored) ? stored : null;
    } catch {
      // Modo privado o almacenamiento bloqueado: se cae al tema del sistema.
      return null;
    }
  },

  write(theme: Theme): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Sin persistencia la app sigue funcionando; el tema dura la sesión.
    }
  },

  clear(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // idem
    }
  }
};
