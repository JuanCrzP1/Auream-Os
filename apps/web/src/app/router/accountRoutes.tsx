import type { ReactElement } from "react";
import { Route } from "react-router-dom";
import { ProfilePage } from "@features/account/pages/ProfilePage";
import { CompanyPage } from "@features/account/pages/CompanyPage";
import { AppShell } from "@shared/ui/app-shell/AppShell";
import { SIDEBAR_ROUTES } from "../navigation/sidebar/sidebar-routes";
import { ProtectedRoute } from "./ProtectedRoute";
import { BillingComingSoon, DashboardComingSoon, HelpComingSoon, TeamComingSoon } from "./placeholders/ComingSoonPages";

/**
 * Las rutas del menú de la cuenta (y el Dashboard): Mi perfil y Empresa ya
 * funcionan; Equipo, Pagos y suscripciones, Ayuda y Dashboard muestran
 * «Próximamente» en vez de mandar a otra página sin avisar.
 *
 * Se devuelven como elementos `<Route>` (no como componente) para ir dentro de
 * `<Routes>`.
 */
const PAGES: ReadonlyArray<readonly [string, ReactElement]> = [
  [SIDEBAR_ROUTES.profile, <ProfilePage />],
  [SIDEBAR_ROUTES.settings, <CompanyPage />],
  [SIDEBAR_ROUTES.team, <TeamComingSoon />],
  [SIDEBAR_ROUTES.billing, <BillingComingSoon />],
  [SIDEBAR_ROUTES.help, <HelpComingSoon />],
  [SIDEBAR_ROUTES.dashboard, <DashboardComingSoon />]
];

export function accountRoutes(): ReactElement[] {
  return PAGES.map(([path, page]) => (
    <Route
      key={path}
      path={path}
      element={
        <ProtectedRoute>
          <AppShell>{page}</AppShell>
        </ProtectedRoute>
      }
    />
  ));
}
