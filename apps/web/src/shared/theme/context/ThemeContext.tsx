import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_THEME, oppositeTheme, resolveTheme, type Theme, type ThemePreference } from "../contracts/Theme";
import { applyThemeToDocument } from "../dom/applyThemeToDocument";
import { themeStore } from "../storage/themeStore";

/**
 * Tema activo de la aplicación.
 *
 * Responsabilidad única: mantener la preferencia en memoria, persistir la
 * elección del usuario y reflejar en el documento el tema que corresponde.
 *
 * Precedencia: elección guardada > DEFAULT_THEME (oscuro). La app es
 * oscura de fábrica; el claro solo aparece si alguien lo pide. «Sistema»
 * sigue al equipo y cambia solo cuando el equipo cambia.
 */

interface ThemeContextValue {
  /** El tema que se pinta. */
  readonly theme: Theme;
  /** Lo que eligió la persona (claro, oscuro o el del sistema). */
  readonly preference: ThemePreference;
  readonly setTheme: (theme: Theme) => void;
  readonly setPreference: (preference: ThemePreference) => void;
  readonly toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.(DARK_QUERY).matches);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => themeStore.read() ?? DEFAULT_THEME);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
  const theme = resolveTheme(preference, prefersDark);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  // Con «sistema», seguir al equipo cuando cambie (p. ej. modo noche automático).
  useEffect(() => {
    if (preference !== "system") return;
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return;
    const onChange = () => setPrefersDark(query.matches);
    onChange();
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    themeStore.write(next);
    setPreferenceState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = oppositeTheme(theme);
    themeStore.write(next);
    setPreferenceState(next);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, preference, setTheme: setPreference, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider");
  }

  return value;
}
