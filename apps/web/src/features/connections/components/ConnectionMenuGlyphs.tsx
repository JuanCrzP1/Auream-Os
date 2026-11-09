// Iconos del menú de acciones de una conexión (trazo, como los del módulo).
// Decorativos: el texto del menú es el nombre accesible.

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

/** Reconectar / vincular: un QR con flecha. */
export function ReconnectGlyph() {
  return (
    <svg {...svg}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 20v-4h-4" />
    </svg>
  );
}

/** Reiniciar: flecha circular. */
export function RestartGlyph() {
  return (
    <svg {...svg}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4v4.5H8" />
    </svg>
  );
}

/** Desconectar: enchufe cortado. */
export function UnplugGlyph() {
  return (
    <svg {...svg}>
      <path d="m19 5-3 3" />
      <path d="m2 22 3-3" />
      <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
      <path d="M7.5 13.5 10 11" />
      <path d="M10.5 16.5 13 14" />
      <path d="m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z" />
    </svg>
  );
}

/** Ver estado: pulso. */
export function PulseGlyph() {
  return (
    <svg {...svg}>
      <path d="M3 12h4l2.5-6 5 12 2.5-6H21" />
    </svg>
  );
}

export function PencilGlyph() {
  return (
    <svg {...svg}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function TrashGlyph() {
  return (
    <svg {...svg}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5.5 7l1 12a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8l1-12" />
      <path d="M9 7V4.5h6V7" />
    </svg>
  );
}
