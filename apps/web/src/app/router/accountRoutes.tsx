import type { ReactElement } from "react";
import { Navigate, Route, useLocation } from "react-router-dom";
import { AppShell } from "@shared/ui/app-shell/AppShell";
import { SIDEBAR_ROUTES } from "../navigation/sidebar/sidebar-routes";
import { SETTINGS_ROUTES } from "../settings/settings-sections";
import { SettingsScreen } from "../settings/SettingsScreen";
import { ProtectedRoute } from "./ProtectedRoute";
import { HelpComingSoon } from "./placeholders/ComingSoonPages";

/**
 * Las rutas de la cuenta. Configuración (`/settings/:section`) va a pantalla
 * completa, SIN la barra de la app: Mi perfil, Apariencia, General, Equipo,
 * Plan y pagos y Seguridad son secciones suyas. Las direcciones de antes
 * (`/profile`, `/team`, `/billing`, `/settings?tab=…`) llevan a su sección.
 * Ayuda sigue dentro de la app («Próximamente»).
 *
 * Se devuelven como elementos `<Route>` (no como componente) para ir dentro de
 * `<Routes>`.
 */

/** `/settings` y su antigua `?tab=`: a la sección que corresponde. */
function SettingsIndex() {
  const tab = new URLSearchParams(useLocation().search).get("tab");
  const to = tab === "team" ? SETTINGS_ROUTES.team : tab === "appearance" ? SETTINGS_ROUTES.appearance : SETTINGS_ROUTES.general;
  return <Navigate to={to} replace />;
}

const REDIRECTS: ReadonlyArray<readonly [string, string]> = [
  [SIDEBAR_ROUTES.profile, SETTINGS_ROUTES.profile],
  [SIDEBAR_ROUTES.team, SETTINGS_ROUTES.team],
  [SIDEBAR_ROUTES.billing, SETTINGS_ROUTES.billing]
];

export function accountRoutes(): ReactElement[] {
  return [
    <Route
      key="settings-section"
      path="/settings/:section"
      element={
        <ProtectedRoute>
          <SettingsScreen />
        </ProtectedRoute>
      }
    />,
    <Route key="settings" path={SIDEBAR_ROUTES.settings} element={<SettingsIndex />} />,
    ...REDIRECTS.map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />),
    <Route
      key="help"
      path={SIDEBAR_ROUTES.help}
      element={
        <ProtectedRoute>
          <AppShell>
            <HelpComingSoon />
          </AppShell>
        </ProtectedRoute>
      }
    />
  ];
}
