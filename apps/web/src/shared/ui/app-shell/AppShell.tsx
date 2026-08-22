import type { ReactNode } from "react";
import { AppSidebar } from "../AppSidebar";
import "./app-shell.css";

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
  return (
    <div className="app-shell">
      <AppSidebar />
      <main className="app-shell__main">{children}</main>
    </div>
  );
}
