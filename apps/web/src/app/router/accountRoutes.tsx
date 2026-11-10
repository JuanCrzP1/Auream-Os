import type { ReactElement } from "react";
import { Navigate, Route } from "react-router-dom";
import { ProfilePage } from "@features/account/pages/ProfilePage";
import { SettingsPage, type SettingsTab } from "@features/account/pages/SettingsPage";
import { TeamSettings } from "@features/team/components/TeamSettings";
import { AppShell } from "@shared/ui/app-shell/AppShell";
import { SIDEBAR_ROUTES } from "../navigation/sidebar/sidebar-routes";
import { ProtectedRoute } from "./ProtectedRoute";
import { BillingComingSoon, HelpComingSoon } from "./placeholders/ComingSoonPages";

/**
 * Las rutas del menú de la cuenta: Mi perfil y Configuración (Empresa, Equipo
 * y Apariencia) ya funcionan; Pagos y suscripciones y Ayuda muestran
 * «Próximamente» en vez de mandar a otra página sin avisar.
 *
 * Aquí, en la capa de la app, se arma Configuración con las pestañas de cada
 * módulo: un módulo no importa a otro (Cuenta no conoce Equipo).
 *
 * Se devuelven como elementos `<Route>` (no como componente) para ir dentro de
 * `<Routes>`.
 */
const SETTINGS_TABS: ReadonlyArray<SettingsTab> = [{ id: "team", label: "Equipo", content: <TeamSettings /> }];
const PAGES: ReadonlyArray<readonly [string, ReactElement]> = [
  [SIDEBAR_ROUTES.profile, <ProfilePage />],
  [SIDEBAR_ROUTES.settings, <SettingsPage extraTabs={SETTINGS_TABS} />],
  // «Equipo» del menú abre su pestaña de Configuración.
  [SIDEBAR_ROUTES.team, <Navigate to={`${SIDEBAR_ROUTES.settings}?tab=team`} replace />],
  [SIDEBAR_ROUTES.billing, <BillingComingSoon />],
  [SIDEBAR_ROUTES.help, <HelpComingSoon />]
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
