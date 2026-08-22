import type { ReactNode } from "react";
import { AppSidebar } from "@shared/ui/AppSidebar";
import "./builder-shell.css";

interface BuilderShellProps {
  children: ReactNode;
}

/**
 * BuilderShell — wrapper de layout exclusivo del editor visual.
 *
 * Responsabilidad única: sidebar + área de editor de flows.
 * NO usar para el hub. El hub tiene AppShell.
 */
export function BuilderShell({ children }: BuilderShellProps) {
  return (
    <div className="builder-shell">
      <AppSidebar />
      {children}
    </div>
  );
}
