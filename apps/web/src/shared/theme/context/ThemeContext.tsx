import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_THEME, oppositeTheme, type Theme } from "../contracts/Theme";
import { applyThemeToDocument } from "../dom/applyThemeToDocument";
import { themeStore } from "../storage/themeStore";

/**
 * Tema activo de la aplicación.
 *
 * Responsabilidad única: mantener el tema en memoria, persistir la elección
 * del usuario y reflejarla en el documento.
 *
 * Precedencia: elección guardada > DEFAULT_THEME (oscuro). La app es
 * oscura de fábrica; el claro solo aparece si alguien lo pide.
 */

interface ThemeContextValue {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
  readonly toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): Theme {
  return themeStore.read() ?? DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    themeStore.write(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = oppositeTheme(current);
      themeStore.write(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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
