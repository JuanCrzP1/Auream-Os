import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { oppositeTheme, type Theme } from "../contracts/Theme";
import { applyThemeToDocument } from "../dom/applyThemeToDocument";
import { themeStore } from "../storage/themeStore";
import { getSystemTheme, subscribeToSystemTheme } from "../system/systemTheme";

/**
 * Tema activo de la aplicación.
 *
 * Responsabilidad única: mantener el tema en memoria, persistir la elección
 * del usuario y reflejarla en el documento.
 *
 * Precedencia: elección guardada > preferencia del sistema. Mientras el
 * usuario no elija, la app sigue al sistema en vivo.
 */

interface ThemeContextValue {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
  readonly toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): Theme {
  return themeStore.read() ?? getSystemTheme();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    return subscribeToSystemTheme((systemTheme) => {
      // Solo se sigue al sistema si el usuario no ha elegido nada.
      if (themeStore.read() === null) {
        setThemeState(systemTheme);
      }
    });
  }, []);

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
