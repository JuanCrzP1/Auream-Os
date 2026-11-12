import type { ReactElement } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AppearanceSettings } from "@features/account/components/AppearanceSettings";
import { CompanySettings } from "@features/account/components/CompanySettings";
import { ProfileSettings } from "@features/account/components/ProfileSettings";
import { QuickRepliesSettings } from "@features/conversations/quick-replies/QuickRepliesSettings";
import { TeamSettings } from "@features/team/components/TeamSettings";
import { lastAppLocation } from "@shared/navigation/lastAppLocation";
import { SettingsLayout } from "@shared/ui/settings-layout/SettingsLayout";
import { StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { SETTINGS_GROUPS, SETTINGS_ROUTES, type SettingsSectionId } from "./settings-sections";

const soon = (what: string) => <StateCard icon={StateIcons.sparkles} title="Muy pronto" description={what} />;

/** Qué módulo pone el contenido de cada sección. Aquí, en la capa de la app: los módulos no se importan entre sí. */
const CONTENT: Readonly<Record<SettingsSectionId, () => ReactElement>> = {
  profile: () => <ProfileSettings />,
  appearance: () => <AppearanceSettings />,
  general: () => <CompanySettings />,
  team: () => <TeamSettings />,
  billing: () => soon("Aquí vas a ver tu plan, lo que consumes en el mes, tu método de pago y tus facturas."),
  "quick-replies": () => <QuickRepliesSettings />,
  security: () => soon("Aquí vas a decidir cómo entra tu equipo: verificación en dos pasos y sesiones abiertas.")
};

const ITEMS = SETTINGS_GROUPS.flatMap((group) => group.items);

/**
 * `/settings/:section` — Configuración a pantalla completa, sin la barra de la
 * app. Una sección que no existe lleva a General.
 */
export function SettingsScreen() {
  const { section } = useParams();
  const current = ITEMS.find((item) => item.id === section);
  if (!current) return <Navigate to={SETTINGS_ROUTES.general} replace />;

  return (
    <SettingsLayout groups={SETTINGS_GROUPS} current={current} backTo={lastAppLocation()}>
      {CONTENT[current.id as SettingsSectionId]()}
    </SettingsLayout>
  );
}
