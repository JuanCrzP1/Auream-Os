import { useTheme } from "../context/ThemeContext";
import { ThemeIcons } from "./theme-icons";
import "../styles/theme-toggle.css";

interface ThemeToggleButtonProps {
  /** Clase adicional para posicionar el botón en cada contenedor. */
  readonly className?: string;
}

/**
 * Conmutador de modo claro / oscuro.
 *
 * Responsabilidad única: presentar el estado del tema y pedir el cambio.
 * No sabe de persistencia ni del DOM: eso vive en el módulo `shared/theme`.
 */
export function ThemeToggleButton({ className }: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";
  const label = isDark ? "Activar modo claro" : "Activar modo oscuro";

  return (
    <button
      type="button"
      className={className ? `theme-toggle ${className}` : "theme-toggle"}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      data-theme-state={theme}
    >
      <span className="theme-toggle__icons" aria-hidden="true">
        <span className="theme-toggle__icon theme-toggle__icon--sun">{ThemeIcons.sun}</span>
        <span className="theme-toggle__icon theme-toggle__icon--moon">{ThemeIcons.moon}</span>
      </span>
    </button>
  );
}
