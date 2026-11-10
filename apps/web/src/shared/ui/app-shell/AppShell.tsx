import type { ReactNode } from "react";
import { AppSidebar } from "../AppSidebar";
import "./app-shell.css";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { rememberAppLocation } from "@shared/navigation/lastAppLocation";

interface AppShellProps {
  children: ReactNode;
}

/**
 * AppShell — wrapper de layout para las páginas del hub.
 *
 * Responsabilidad única: sidebar izquierdo + área de contenido principal.
 * NO usar para el builder. El builder tiene BuilderShell.
 */
export function AppShell({ children }: AppShellProps) {
  // Configuración se abre fuera de este marco: recuerda de dónde se fue.
  const location = useLocation();
  useEffect(() => {
    rememberAppLocation(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return (
    <div className="app-shell">
      <AppSidebar />
      <main className="app-shell__main">{children}</main>
    </div>
  );
}
