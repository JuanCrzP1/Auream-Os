import "./appearance-settings.css";
import { useTheme } from "@shared/theme/context/ThemeContext";
import type { ThemePreference } from "@shared/theme/contracts/Theme";

const OPTIONS: ReadonlyArray<{ readonly value: ThemePreference; readonly title: string; readonly description: string }> = [
  { value: "light", title: "Claro", description: "Fondo claro, cómodo de día." },
  { value: "dark", title: "Oscuro", description: "La identidad de Auream; descansa la vista de noche." },
  { value: "system", title: "Sistema", description: "Sigue el modo de tu equipo y cambia solo con él." }
];

/**
 * Configuración → Apariencia: cómo se ve Auream en este navegador (claro,
 * oscuro o el del sistema). Es lo mismo que el tema del menú de la cuenta,
 * con una vista previa de cada opción.
 */
export function AppearanceSettings() {
  const { preference, setPreference } = useTheme();
  return (
    <section className="account-section" aria-labelledby="appearance-title">
      <div className="account-section__head">
        <h2 className="account-section__title" id="appearance-title">Tema</h2>
        <p className="account-section__subtitle">Se guarda en este navegador. También lo cambias desde el menú de tu cuenta.</p>
      </div>
      <div className="appearance" role="radiogroup" aria-labelledby="appearance-title">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={preference === option.value}
            className={`appearance__option${preference === option.value ? " is-active" : ""}`}
            onClick={() => setPreference(option.value)}
          >
            <span className={`appearance__preview appearance__preview--${option.value}`} aria-hidden="true">
              <span className="appearance__bar" />
              <span className="appearance__line" />
              <span className="appearance__line appearance__line--short" />
            </span>
            <span className="appearance__title">{option.title}</span>
            <span className="appearance__description">{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
