import type { ReactElement } from "react";
import { SIDEBAR_ROUTES } from "./sidebar-routes";
import { SidebarIcons } from "./sidebar-icons";

/**
 * NavItem — entrada de la navegación principal del sidebar.
 */
export interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: ReactElement;
}

/**
 * sidebarItems — orden canónico de los ítems del sidebar: el trabajo del día.
 *
 * Para agregar o reordenar ítems, modificar SOLO este array.
 * El AppSidebar renderiza este array sin conocer su contenido.
 *
 * Lo administrativo (Mi perfil, Empresa, Equipo, Pagos y suscripciones,
 * Ayuda) vive en el menú de la cuenta, abajo en la barra: es el estándar de
 * las apps con barra lateral (`app/navigation/account/account-menu-items.tsx`).
 *
 * Orden actual:
 *   Dashboard → Conversaciones → Automatizaciones → AI Agents →
 *   Conexiones → Contactos → Integraciones
 */
export const sidebarItems: NavItem[] = [
  { label: "Dashboard",       path: SIDEBAR_ROUTES.dashboard,     icon: SidebarIcons.dashboard     },
  { label: "Conversaciones",  path: SIDEBAR_ROUTES.conversations,  icon: SidebarIcons.conversations  },
  { label: "Automatizaciones",path: SIDEBAR_ROUTES.automations,    icon: SidebarIcons.automations    },
  { label: "AI Agents",       path: SIDEBAR_ROUTES.aiAgents,       icon: SidebarIcons.aiAgents       },
  { label: "Conexiones",      path: SIDEBAR_ROUTES.connections,    icon: SidebarIcons.connections    },
  { label: "Contactos",       path: SIDEBAR_ROUTES.contacts,       icon: SidebarIcons.contacts       },
  { label: "Integraciones",   path: SIDEBAR_ROUTES.integrations,   icon: SidebarIcons.integrations   },
];
