// Iconos de las tarjetas de estado (24×24, trazo). Compartidos por los módulos.

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const StateIcons = {
  offline: (
    <svg {...svg}>
      <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.6 8.2 4 4 0 0 1 18 16" />
      <path d="M12 12v4" />
      <path d="M12 19.5h.01" />
    </svg>
  ),
  people: (
    <svg {...svg}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14a6.5 6.5 0 0 1 3.5 5.5" />
    </svg>
  ),
  search: (
    <svg {...svg}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  ),
  tag: (
    <svg {...svg}>
      <path d="M12.5 3H19a2 2 0 0 1 2 2v6.5a2 2 0 0 1-.6 1.4l-7.5 7.5a2 2 0 0 1-2.8 0l-6.5-6.5a2 2 0 0 1 0-2.8l7.5-7.5A2 2 0 0 1 12.5 3z" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  ),
  sparkles: (
    <svg {...svg}>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8-5.7-1.9L10.2 9z" />
      <path d="M19 3v3M17.5 4.5h3M5 17v3M3.5 18.5h3" />
    </svg>
  ),
  target: (
    <svg {...svg}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  lock: (
    <svg {...svg}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  )
} as const;
