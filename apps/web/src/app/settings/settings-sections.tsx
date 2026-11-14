import type { ReactElement } from "react";
import type { SettingsNavGroup } from "@shared/ui/settings-layout/SettingsLayout";
import { SidebarIcons } from "../navigation/sidebar/sidebar-icons";

// ---------------------------------------------------------------------------
// Las secciones de Configuración, agrupadas como en Stripe o Vercel: lo tuyo
// (en todas las empresas), lo de la empresa activa, sus datos y sus chats. Agregar una sección es
// una línea aquí y su contenido en `SettingsScreen`.
// ---------------------------------------------------------------------------

export const SETTINGS_ROUTES = {
  profile: "/settings/profile",
  appearance: "/settings/appearance",
  general: "/settings/general",
  team: "/settings/team",
  billing: "/settings/billing",
  security: "/settings/security",
  "contact-fields": "/settings/contact-fields",
  "business-data": "/settings/business-data",
  labels: "/settings/labels",
  "quick-replies": "/settings/quick-replies"
} as const;

export type SettingsSectionId = keyof typeof SETTINGS_ROUTES;

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const icon = (paths: ReactElement) => (
  <svg viewBox="0 0 24 24" {...STROKE}>
    {paths}
  </svg>
);

const Icons = {
  appearance: icon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
    </>
  ),
  general: icon(
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4" />
    </>
  ),
  contactFields: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 14h3" />
    </>
  ),
  businessData: icon(
    <>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M9 20v-5h6v5M4 20h16M9.5 10.5h5" />
    </>
  ),
  labels: icon(
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  quickReplies: icon(<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />),
  security: icon(<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3zM9.5 12l2 2 3.5-4" />)
};

export const SETTINGS_GROUPS: ReadonlyArray<SettingsNavGroup> = [
  {
    title: "Tu cuenta",
    items: [
      { id: "profile", label: "Mi perfil", path: SETTINGS_ROUTES.profile, icon: SidebarIcons.profile, description: "Tu foto, tus datos y tu contraseña. Son tuyos en todas las empresas a las que perteneces." },
      { id: "appearance", label: "Apariencia", path: SETTINGS_ROUTES.appearance, icon: Icons.appearance, description: "Cómo se ve Auream en este equipo: claro, oscuro o como tu sistema." }
    ]
  },
  {
    title: "Empresa",
    items: [
      { id: "general", label: "General", path: SETTINGS_ROUTES.general, icon: Icons.general, description: "El nombre, el logo y la zona horaria de la empresa. Los flujos corren con esa hora." },
      { id: "team", label: "Equipo", path: SETTINGS_ROUTES.team, icon: SidebarIcons.team, description: "Las personas de la empresa y lo que puede hacer cada una." },
      { id: "billing", label: "Plan y pagos", path: SETTINGS_ROUTES.billing, icon: SidebarIcons.billing, description: "Tu plan, lo que consumes en el mes, tu método de pago y tus facturas.", soon: true },
      { id: "security", label: "Seguridad", path: SETTINGS_ROUTES.security, icon: Icons.security, description: "Cómo entra tu equipo y quién puede hacerlo.", soon: true }
    ]
  },
  {
    title: "Datos",
    items: [
      {
        id: "contact-fields",
        label: "Campos del cliente",
        path: SETTINGS_ROUTES["contact-fields"],
        icon: Icons.contactFields,
        description: "Lo que sabes de cada cliente y cambia de uno a otro: su ciudad, su cumpleaños, su talla."
      },
      {
        id: "business-data",
        label: "Datos del negocio",
        path: SETTINGS_ROUTES["business-data"],
        icon: Icons.businessData,
        description: "Tu horario, tu dirección, tu link de pago: lo que les dices igual a todos tus clientes, escrito una sola vez."
      },
      {
        id: "labels",
        label: "Etiquetas",
        path: SETTINGS_ROUTES.labels,
        icon: Icons.labels,
        description: "Cuántos clientes tiene cada una, cuánto venden y quién la usa (embudos, flujos, difusiones, webhooks). Une las repetidas y borra sin romper nada."
      }
    ]
  },
  {
    title: "Chats",
    items: [
      {
        id: "quick-replies",
        label: "Respuestas rápidas",
        path: SETTINGS_ROUTES["quick-replies"],
        icon: Icons.quickReplies,
        description: "Los mensajes que tu equipo envía en el chat sin copiar y pegar, organizados por categoría. En el chat se buscan escribiendo «/»."
      }
    ]
  }
];
