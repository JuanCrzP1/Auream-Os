import "./theme-switch.css";
import type { ReactElement } from "react";
import { useTheme } from "@shared/theme/context/ThemeContext";
import { ThemeIcons } from "@shared/theme/components/theme-icons";
import type { ThemePreference } from "@shared/theme/contracts/Theme";
import { AccountMenuIcons } from "@app/navigation/account/account-menu-items";

const OPTIONS: ReadonlyArray<{ readonly value: ThemePreference; readonly label: string; readonly icon: ReactElement }> = [
  { value: "light", label: "Claro", icon: ThemeIcons.sun },
  { value: "dark", label: "Oscuro", icon: ThemeIcons.moon },
  { value: "system", label: "Sistema", icon: AccountMenuIcons.system }
];

/**
 * Tema dentro del menú de la cuenta: claro, oscuro o el del sistema (sigue al
 * equipo). Un grupo de opciones, como en los ajustes de un teléfono.
 */
export function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="account-menu__theme">
      <span className="account-menu__theme-label" id="account-theme-label">Tema</span>
      <div className="account-theme" role="radiogroup" aria-labelledby="account-theme-label">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={preference === option.value}
            className={`account-theme__option${preference === option.value ? " is-active" : ""}`}
            onClick={() => setPreference(option.value)}
            title={option.label}
          >
            <span className="account-theme__icon" aria-hidden="true">{option.icon}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
