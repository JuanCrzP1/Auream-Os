// Iconos del laboratorio (trazo, como los del editor). Decorativos: el botón
// lleva su nombre accesible.

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

/** Matraz: probar el flujo. */
export function FlaskIcon() {
  return (
    <svg {...svg}>
      <path d="M9 3h6" />
      <path d="M10 3v6.2L4.8 18.1A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.9L14 9.2V3" />
      <path d="M7.5 15h9" />
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg {...svg}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

export function RestartIcon() {
  return (
    <svg {...svg}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4v4.5H8" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...svg}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg {...svg}>
      <path d="M21 3 10 14" />
      <path d="m21 3-7 18-4-7-7-4Z" />
    </svg>
  );
}
