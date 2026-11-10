/**
 * sidebar-routes.ts — rutas canónicas de la navegación principal.
 *
 * Fuente de verdad para todas las rutas del sidebar.
 * Importar desde aquí en sidebar-items, AppRouter y cualquier
 * componente que necesite navegar a estas rutas.
 */
export const SIDEBAR_ROUTES = {
  dashboard:     "/dashboard",
  conversations: "/conversations",
  crm:           "/crm",
  automations:   "/automations",
  aiAgents:      "/ai-agents",
  broadcasts:    "/broadcasts",
  groups:        "/groups",
  metaAds:       "/meta-ads",
  sales:         "/sales",
  connections:   "/connections",
  /** Antigua dirección de Contactos: ahora es el CRM (redirige a `crm`). */
  contacts:      "/contacts",
  integrations:  "/integrations",
  team:          "/team",
  billing:       "/billing",
  profile:       "/profile",
  settings:      "/settings",
  help:          "/help",
} as const;

export type SidebarRoute = typeof SIDEBAR_ROUTES[keyof typeof SIDEBAR_ROUTES];
