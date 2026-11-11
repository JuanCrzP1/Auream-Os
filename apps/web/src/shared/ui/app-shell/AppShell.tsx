import type { ReactNode } from "react";
import { AppSidebar } from "../AppSidebar";
import "./app-shell.css";
import "./app-shell-mobile.css";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AureamLockup } from "@shared/brand/AureamLockup";
import { rememberAppLocation } from "@shared/navigation/lastAppLocation";
import { HelpPanel } from "@shared/help/HelpPanel";
import { useSidebarState } from "./useSidebarState";

interface AppShellProps {
  children: ReactNode;
}

/**
 * AppShell — wrapper de layout para las páginas del hub.
 *
 * Responsabilidad única: sidebar izquierdo + área de contenido principal. En
 * PC la barra se contrae a íconos; en celular se esconde y se abre con ☰
 * desde la barra de arriba, por encima del contenido.
 * NO usar para el builder. El builder tiene BuilderShell.
 */
export function AppShell({ children }: AppShellProps) {
  const { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile } = useSidebarState();
  // Configuración se abre fuera de este marco: recuerda de dónde se fue.
  const location = useLocation();
  useEffect(() => {
    rememberAppLocation(`${location.pathname}${location.search}`);
    closeMobile();
  }, [location.pathname, location.search, closeMobile]);

  return (
    <div className={`app-shell${mobileOpen ? " is-menu-open" : ""}`}>
      <header className="app-shell__topbar">
        <button type="button" className="app-shell__menu" aria-label="Abrir menú" aria-controls="app-sidebar" aria-expanded={mobileOpen} onClick={openMobile}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <AureamLockup size="sm" />
      </header>
      <AppSidebar collapsed={collapsed} onToggle={toggleCollapsed} onClose={closeMobile} />
      <div className="app-shell__backdrop" onClick={closeMobile} role="presentation" />
      <main className="app-shell__main">{children}</main>
      <HelpPanel />
    </div>
  );
}
