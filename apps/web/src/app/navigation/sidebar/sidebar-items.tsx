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
 * sidebarItems — orden canónico de los ítems del sidebar.
 *
 * Para agregar o reordenar ítems, modificar SOLO este array.
 * El AppSidebar renderiza este array sin conocer su contenido.
 *
 * Orden actual:
 *   Dashboard → Conversaciones → Automatizaciones → Conexiones →
 *   Contactos → Integraciones → AI Agents → Equipo →
 *   Facturación → Mi perfil → Configuración → Ayuda
 */
export const sidebarItems: NavItem[] = [
  { label: "Dashboard",       path: SIDEBAR_ROUTES.dashboard,     icon: SidebarIcons.dashboard     },
  { label: "Conversaciones",  path: SIDEBAR_ROUTES.conversations,  icon: SidebarIcons.conversations  },
  { label: "Automatizaciones",path: SIDEBAR_ROUTES.automations,    icon: SidebarIcons.automations    },
  { label: "Conexiones",      path: SIDEBAR_ROUTES.connections,    icon: SidebarIcons.connections    },
  { label: "Contactos",       path: SIDEBAR_ROUTES.contacts,       icon: SidebarIcons.contacts       },
  { label: "Integraciones",   path: SIDEBAR_ROUTES.integrations,   icon: SidebarIcons.integrations   },
  { label: "AI Agents",       path: SIDEBAR_ROUTES.aiAgents,       icon: SidebarIcons.aiAgents       },
  { label: "Equipo",          path: SIDEBAR_ROUTES.team,           icon: SidebarIcons.team           },
  { label: "Facturación",     path: SIDEBAR_ROUTES.billing,        icon: SidebarIcons.billing        },
  { label: "Mi perfil",       path: SIDEBAR_ROUTES.profile,        icon: SidebarIcons.profile        },
  { label: "Configuración",   path: SIDEBAR_ROUTES.settings,       icon: SidebarIcons.settings       },
  { label: "Ayuda",           path: SIDEBAR_ROUTES.help,           icon: SidebarIcons.help           },
];
