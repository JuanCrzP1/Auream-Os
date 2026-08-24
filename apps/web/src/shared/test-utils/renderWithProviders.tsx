import type { ReactElement, ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/context/AuthContext";
import { ActiveTenantProvider } from "../auth/tenant/ActiveTenantContext";

/**
 * Render de tests con los providers reales de la aplicación.
 *
 * Existe para que ningún test tenga que reconstruir el árbol de contextos por
 * su cuenta: si mañana se añade otro provider, se añade aquí una sola vez.
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialPath = "/" }: { initialPath?: string } = {}
): RenderResult {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <ActiveTenantProvider>{ui}</ActiveTenantProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

/** Envoltorio para `renderHook`, que necesita un componente y no un elemento. */
export function ProvidersWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>
        <ActiveTenantProvider>{children}</ActiveTenantProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}
