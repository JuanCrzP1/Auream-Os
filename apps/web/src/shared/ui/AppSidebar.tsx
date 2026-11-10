import "./app-sidebar.css";
import { NavLink } from "react-router-dom";
import { sidebarItems } from "@app/navigation/sidebar/sidebar-items";
import { AureamLockup } from "../brand/AureamLockup";
import { AccountCard } from "../account/AccountCard";

/**
 * La barra lateral: la marca, el trabajo del día (`sidebarItems`) y, abajo, la
 * tarjeta de la cuenta con su menú (perfil, empresa, tema, cerrar sesión…).
 */
export function AppSidebar() {
  return (
    <aside className="app-sidebar">
      <AureamLockup size="sm" className="app-sidebar__brand" />

      <nav className="app-sidebar__nav">
        {sidebarItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              isActive ? "app-sidebar__item is-active" : "app-sidebar__item"
            }
          >
            <span className="app-sidebar__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <AccountCard />
    </aside>
  );
}
