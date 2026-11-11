import "./side-panel/side-panel.css";
import "./app-sidebar.css";
import "./app-sidebar-collapsed.css";
import { NavLink } from "react-router-dom";
import { sidebarItems } from "@app/navigation/sidebar/sidebar-items";
import { AureamLockup } from "../brand/AureamLockup";
import { AccountCard } from "../account/AccountCard";

interface Props {
  /** PC: solo íconos (el nombre sale al pasar el mouse). */
  readonly collapsed?: boolean;
  readonly onToggle?: () => void;
  /** Celular: cerrar el menú (✕ o al elegir una opción). */
  readonly onClose?: () => void;
}

/**
 * La barra lateral: la marca, el trabajo del día (`sidebarItems`) y, abajo, la
 * tarjeta de la cuenta con su menú, la campana y soporte. En PC se contrae a
 * una franja de íconos; en celular es el menú que abre ☰ (`AppShell`).
 */
export function AppSidebar({ collapsed = false, onToggle, onClose }: Props) {
  return (
    <aside id="app-sidebar" className={`app-sidebar ui-side-panel${collapsed ? " is-collapsed" : ""}`} aria-label="Menú principal">
      <div className="app-sidebar__head">
        <AureamLockup size="sm" className="app-sidebar__brand" />
        {onToggle ? (
          <button type="button" className="app-sidebar__toggle" aria-label={collapsed ? "Expandir menú" : "Contraer menú"} title={collapsed ? "Expandir menú (Ctrl + B)" : "Contraer menú (Ctrl + B)"} aria-expanded={!collapsed} aria-controls="app-sidebar" onClick={onToggle}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M9.5 4.5v15" /></svg>
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className="app-sidebar__close" aria-label="Cerrar menú" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        ) : null}
      </div>

      <nav className="app-sidebar__nav">
        {sidebarItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            data-label={item.label}
            onClick={onClose}
            className={({ isActive }) =>
              isActive ? "app-sidebar__item is-active" : "app-sidebar__item"
            }
          >
            <span className="app-sidebar__icon" aria-hidden="true">{item.icon}</span>
            <span className="app-sidebar__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <AccountCard />
    </aside>
  );
}
