/**
 * sidebar-icons.tsx — iconos SVG de la navegación principal.
 *
 * Todos los iconos están normalizados:
 *   - viewBox="0 0 24 24"
 *   - fill="none" stroke="currentColor" strokeWidth="1.8"
 *   - strokeLinecap="round" strokeLinejoin="round"
 *
 * Para añadir un nuevo icono: agregar una propiedad aquí y referenciarla
 * en sidebar-items.tsx. El AppSidebar NO importa este archivo directamente.
 */

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const SidebarIcons = {
  dashboard: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),

  conversations: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth={2.2} />
    </svg>
  ),

  automations: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7 6h10M5 8v4c0 2 2 4 7 4s7-2 7-4V8" />
    </svg>
  ),

  connections: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M5 12h14" />
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="19" cy="12" r="2.5" />
      <path d="M5 6.5V9.5M5 14.5v3M19 6.5v3M19 14.5v3" />
      <rect x="1" y="3" width="8" height="4" rx="1.5" />
      <rect x="15" y="3" width="8" height="4" rx="1.5" />
      <rect x="1" y="17" width="8" height="4" rx="1.5" />
      <rect x="15" y="17" width="8" height="4" rx="1.5" />
    </svg>
  ),

  contacts: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),

  integrations: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),

  aiAgents: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M12 2l1.5 3.5L17 7l-3.5 1.5L12 12l-1.5-3.5L7 7l3.5-1.5L12 2z" />
      <path d="M19 14l.75 1.75L21.5 16.5l-1.75.75L19 19l-.75-1.75L16.5 16.5l1.75-.75L19 14z" />
      <path d="M5 17l.5 1.25L6.75 19l-1.25.5L5 21l-.5-1.5L3.25 19l1.25-.5L5 17z" />
    </svg>
  ),

  team: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="12" cy="8" r="3" />
      <circle cx="5" cy="10" r="2.5" />
      <circle cx="19" cy="10" r="2.5" />
      <path d="M12 14c-4 0-7 2-7 4h14c0-2-3-4-7-4z" />
      <path d="M2 20c0-1.5 1.5-3 3-3M22 20c0-1.5-1.5-3-3-3" />
    </svg>
  ),

  billing: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
      <line x1="6" y1="16" x2="10" y2="16" strokeWidth={2} />
    </svg>
  ),

  profile: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  ),

  settings: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),

  help: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  ),
} as const;
