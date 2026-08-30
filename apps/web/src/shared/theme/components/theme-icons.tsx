/**
 * theme-icons.tsx — iconos SVG del conmutador de tema.
 *
 * Normalizados igual que el resto de iconografía de la app:
 *   - viewBox="0 0 24 24"
 *   - fill="none" stroke="currentColor" strokeWidth="1.8"
 *   - strokeLinecap="round" strokeLinejoin="round"
 *
 * Sin color propio: heredan `currentColor` del botón que los contiene.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

export const ThemeIcons = {
  sun: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M4.22 4.22l1.56 1.56M18.22 18.22l1.56 1.56M2.6 12h2.2M19.2 12h2.2M4.22 19.78l1.56-1.56M18.22 5.78l1.56-1.56" />
    </svg>
  ),

  moon: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M20.5 14.4A8.6 8.6 0 0 1 9.6 3.5a8.7 8.7 0 1 0 10.9 10.9z" />
    </svg>
  )
};
