import type { ReactNode } from "react";

/** Trazo de 24 px que toma el color del texto: así sirve igual en claro, en oscuro y sobre el degradado. */
function Stroke({ children }: { readonly children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Iconos de Meta Ads. Decorativos: el nombre lo da el texto de al lado. */
export const AdsIcons = {
  /** Píxel: la diana del bloque «Pixel». */
  pixel: (
    <Stroke>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </Stroke>
  ),
  /** Rendimiento: la curva que sube. */
  performance: (
    <Stroke>
      <path d="M3 17.5 9 11.5l4 4 8-8" />
      <path d="M15 7.5h6v6" />
    </Stroke>
  ),
  /** Cuentas publicitarias: el maletín del negocio. */
  accounts: (
    <Stroke>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3 12.5h18" />
    </Stroke>
  ),
  /** Chat de WhatsApp: la burbuja con su colita. */
  chat: (
    <Stroke>
      <path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z" />
      <path d="M8.5 10.5h7M8.5 13.5h4.5" />
    </Stroke>
  ),
  check: (
    <Stroke>
      <path d="m5.5 12.5 4 4 9-9" />
    </Stroke>
  ),
  plus: (
    <Stroke>
      <path d="M12 5v14M5 12h14" />
    </Stroke>
  )
} as const;
