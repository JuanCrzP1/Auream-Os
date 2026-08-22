import "./app-sidebar.css";
﻿import { NavLink } from "react-router-dom";
import { sidebarItems } from "@app/navigation/sidebar/sidebar-items";

export function AppSidebar() {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div>
          <strong>Bots Flows</strong>
        </div>
      </div>

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

      <footer className="app-sidebar__footer">
        <button type="button" className="app-sidebar__collapse" aria-label="Contraer navegacion">
          <span /><span />
        </button>
      </footer>
    </aside>
  );
}
