import "./app-sidebar.css";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggleButton } from "../theme/components/ThemeToggleButton";
﻿import { NavLink } from "react-router-dom";
import { sidebarItems } from "@app/navigation/sidebar/sidebar-items";
import { BRAND_NAME } from "../brand/brand";

export function AppSidebar() {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div>
          <strong>{BRAND_NAME}</strong>
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
        <SignOutButton />
        <ThemeToggleButton className="app-sidebar__theme-toggle" />
      </footer>
    </aside>
  );
}
