import type { ReactNode } from "react";

/** Trazo de 24 px que toma el color del texto. */
function Stroke({ children }: { readonly children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Iconos de Equipo. Decorativos: el nombre lo da el texto o el `aria-label` del botón. */
export const TeamIcons = {
  users: (
    <Stroke>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2A6.5 6.5 0 0 1 21.5 20" />
    </Stroke>
  ),
  userPlus: (
    <Stroke>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
    </Stroke>
  ),
  mail: (
    <Stroke>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </Stroke>
  ),
  shield: (
    <Stroke>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6L12 3z" />
      <path d="m9 12 2 2 4-4" />
    </Stroke>
  ),
  plus: (
    <Stroke>
      <path d="M12 5v14M5 12h14" />
    </Stroke>
  ),
  check: (
    <Stroke>
      <path d="m5.5 12.5 4 4 9-9" />
    </Stroke>
  ),
  trash: (
    <Stroke>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Stroke>
  ),
  close: (
    <Stroke>
      <path d="M6 6l12 12M18 6 6 18" />
    </Stroke>
  ),
  search: (
    <Stroke>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Stroke>
  ),
  link: (
    <Stroke>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Stroke>
  ),
  swap: (
    <Stroke>
      <path d="M7 4 4 7l3 3M4 7h13M17 20l3-3-3-3M20 17H7" />
    </Stroke>
  ),
  /** Burbuja de chat (el botón de WhatsApp pone el verde). */
  chat: (
    <Stroke>
      <path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z" />
    </Stroke>
  )
} as const;
