import type { ReactNode } from "react";

// Iconos de Ventas: trazo de 1.8 en `currentColor`, para que tomen el color del texto.

const Svg = ({ children }: { readonly children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const SalesIcons = {
  plus: <Svg><path d="M12 5v14M5 12h14" /></Svg>,
  search: <Svg><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>,
  receipt: <Svg><path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21z" /><path d="M9 8h6M9 12h6M9 16h3" /></Svg>,
  box: <Svg><path d="M12 3 4 7v10l8 4 8-4V7z" /><path d="m4 7 8 4 8-4M12 11v10" /></Svg>,
  flow: <Svg><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6H14a4 4 0 0 1 4 4v5.5" /></Svg>,
  user: <Svg><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.5-5.5 7-5.5s6.2 1.9 7 5.5" /></Svg>
} as const;
