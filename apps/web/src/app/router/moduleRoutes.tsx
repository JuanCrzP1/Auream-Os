import type { ReactElement } from "react";
import { Navigate, Route } from "react-router-dom";
import { ContactsPage } from "@features/crm/contacts/pages/ContactsPage";
import { AppShell } from "@shared/ui/app-shell/AppShell";
import { SIDEBAR_ROUTES } from "../navigation/sidebar/sidebar-routes";
import { ProtectedRoute } from "./ProtectedRoute";
import { DashboardPage } from "@features/dashboard/pages/DashboardPage";
import { BroadcastsPage } from "@features/broadcasts/pages/BroadcastsPage";
import { GroupsPage } from "@features/groups/pages/GroupsPage";
import { MetaAdsPage } from "@features/ads/pages/MetaAdsPage";
import { SalesPage } from "@features/sales/pages/SalesPage";

/**
 * Las rutas de los módulos nuevos de la barra lateral. Cada página vive en su
 * módulo (`features/<módulo>/pages`): el CRM (hoy, los contactos con sus
 * etiquetas, que crecerán con etapas y seguimientos) y los que se están
 * construyendo (Dashboard, Difusiones, Grupos y comunidades, Meta Ads y
 * Ventas), que cuentan lo que traerán. Mapa completo: `docs/architecture/modules.md`.
 *
 * `/contacts` era Contactos: ahora es el CRM.
 *
 * Se devuelven como elementos `<Route>` (no como componente) para ir dentro de
 * `<Routes>`.
 */
const PAGES: ReadonlyArray<readonly [string, ReactElement]> = [
  [SIDEBAR_ROUTES.dashboard, <DashboardPage />],
  [SIDEBAR_ROUTES.crm, <ContactsPage />],
  [SIDEBAR_ROUTES.broadcasts, <BroadcastsPage />],
  [SIDEBAR_ROUTES.groups, <GroupsPage />],
  [SIDEBAR_ROUTES.metaAds, <MetaAdsPage />],
  [SIDEBAR_ROUTES.sales, <SalesPage />]
];

export function moduleRoutes(): ReactElement[] {
  return [
    ...PAGES.map(([path, page]) => (
      <Route
        key={path}
        path={path}
        element={
          <ProtectedRoute>
            <AppShell>{page}</AppShell>
          </ProtectedRoute>
        }
      />
    )),
    <Route key={SIDEBAR_ROUTES.contacts} path={SIDEBAR_ROUTES.contacts} element={<Navigate to={SIDEBAR_ROUTES.crm} replace />} />
  ];
}
