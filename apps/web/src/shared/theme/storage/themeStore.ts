import { isThemePreference, type ThemePreference } from "../contracts/Theme";

/**
 * Preferencia de tema elegida explícitamente por el usuario.
 *
 * Responsabilidad única: persistir esa elección entre recargas.
 * Ausencia de valor NO es un error: significa "usar DEFAULT_THEME".
 *
 * IMPORTANTE: la clave está duplicada en el script anti-parpadeo de
 * `apps/web/index.html`. Si se cambia aquí, cambiarla también allí.
 */

const STORAGE_KEY = "bots-ai-theme";

export const themeStore = {
  read(): ThemePreference | null {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return isThemePreference(stored) ? stored : null;
    } catch {
      // Modo privado o almacenamiento bloqueado: se cae al tema por defecto.
      return null;
    }
  },

  write(preference: ThemePreference): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
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
