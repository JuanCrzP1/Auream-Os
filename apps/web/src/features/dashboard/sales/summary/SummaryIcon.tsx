import type { ReactElement } from "react";

// ---------------------------------------------------------------------------
// Íconos del resumen del Dashboard, con la convención de Auream (la del menú
// lateral): 24×24, línea de 1,8 con puntas redondeadas y el color del texto.
// Decorativos: el título de la tarjeta dice lo que es.
// ---------------------------------------------------------------------------

const PATHS = {
  revenue: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.6 9.3c-.5-.8-1.4-1.3-2.6-1.3-1.5 0-2.6.8-2.6 2s1 1.7 2.6 2 2.6.9 2.6 2.1-1.1 2-2.6 2c-1.2 0-2.1-.5-2.6-1.3M12 6.3v1.7M12 16v1.7" />
    </>
  ),
  sales: (
    <>
      <path d="M6 7h12l-1 12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5z" />
      <path d="M9 9V6.5a3 3 0 0 1 6 0V9" />
    </>
  ),
  ticket: (
    <>
      <path d="M12.6 3.5H5A1.5 1.5 0 0 0 3.5 5v7.6c0 .4.2.8.4 1.1l7.4 7.4a1.5 1.5 0 0 0 2.1 0l6.7-6.7a1.5 1.5 0 0 0 0-2.1l-7.4-7.4a1.5 1.5 0 0 0-1.1-.4z" />
      <circle cx="8" cy="8" r="1.3" />
    </>
  ),
  profit: (
    <>
      <path d="m3.5 17 6-6 4 4 7-7.5" />
      <path d="M15 7.5h5.5V13" />
    </>
  ),
  leads: (
    <>
      <circle cx="9" cy="8" r="3.8" />
      <path d="M2.5 20.5a6.5 6.5 0 0 1 13 0M19 8.5v6M16 11.5h6" />
    </>
  ),
  conversion: <path d="M3.5 4.5h17l-6.5 8v6l-4 2v-8z" />,
  roas: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 3.5V8H16" />
      <path d="M12 8v8M14 9.6c-.4-.6-1.1-.9-2-.9-1.1 0-1.9.6-1.9 1.4s.8 1.2 1.9 1.4 1.9.6 1.9 1.4-.8 1.4-1.9 1.4c-.9 0-1.6-.3-2-.9" />
    </>
  ),
  spend: (
    <>
      <path d="m3.5 10.5 13-5.5v14l-13-5.5z" />
      <path d="M16.5 9.5a3 3 0 0 1 0 5M7 14l1.2 5.5h3L10 15.3" />
    </>
  )
} satisfies Record<string, ReactElement>;

export type SummaryIconName = keyof typeof PATHS;

export function SummaryIcon({ name }: { readonly name: SummaryIconName }) {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
