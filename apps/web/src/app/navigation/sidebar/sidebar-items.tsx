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
 * Lo mejor de Leona (bot, chats, difusiones), FunnelChat (CRM, grupos y
 * comunidades, agentes de IA) y Vyper (ventas y anuncios de Meta con su ROAS),
 * en una sola lista. Lo administrativo (Mi perfil, Configuración, Equipo,
 * Pagos y suscripciones, Ayuda) vive en el menú de la cuenta, abajo en la barra
 * (`app/navigation/account/account-menu-items.tsx`).
 *
 * Orden actual:
 *   Dashboard → Conversaciones → CRM → Automatizaciones → Agentes de IA →
 *   Difusiones → Grupos y comunidades → Meta Ads → Ventas → Conexiones →
 *   Integraciones
 */
export const sidebarItems: NavItem[] = [
  { label: "Dashboard",            path: SIDEBAR_ROUTES.dashboard,     icon: SidebarIcons.dashboard     },
  { label: "Conversaciones",       path: SIDEBAR_ROUTES.conversations, icon: SidebarIcons.conversations },
  { label: "CRM",                  path: SIDEBAR_ROUTES.crm,           icon: SidebarIcons.crm           },
  { label: "Automatizaciones",     path: SIDEBAR_ROUTES.automations,   icon: SidebarIcons.automations   },
  { label: "Agentes de IA",        path: SIDEBAR_ROUTES.aiAgents,      icon: SidebarIcons.aiAgents      },
  { label: "Difusiones",           path: SIDEBAR_ROUTES.broadcasts,    icon: SidebarIcons.broadcasts    },
  { label: "Grupos y comunidades", path: SIDEBAR_ROUTES.groups,        icon: SidebarIcons.groups        },
  { label: "Meta Ads",             path: SIDEBAR_ROUTES.metaAds,       icon: SidebarIcons.metaAds       },
  { label: "Ventas",               path: SIDEBAR_ROUTES.sales,         icon: SidebarIcons.sales         },
  { label: "Conexiones",           path: SIDEBAR_ROUTES.connections,   icon: SidebarIcons.connections   },
  { label: "Integraciones",        path: SIDEBAR_ROUTES.integrations,  icon: SidebarIcons.integrations  },
];
