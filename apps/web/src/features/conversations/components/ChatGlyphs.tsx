// Iconos de la bandeja (trazo). Decorativos: el texto accesible va al lado.

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const SearchGlyph = () => (
  <svg {...svg}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);

export const BackGlyph = () => (
  <svg {...svg} strokeWidth={2.2}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);

export const SendGlyph = () => (
  <svg {...svg} fill="currentColor" stroke="none">
    <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
  </svg>
);

export const BoltGlyph = () => (
  <svg {...svg}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />
  </svg>
);

export const BotGlyph = () => (
  <svg {...svg}>
    <rect x="4" y="8" width="16" height="11" rx="3" />
    <path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5" />
  </svg>
);

export const ChatsGlyph = () => (
  <svg {...svg}>
    <path d="M20 12a8 8 0 0 1-11.8 7L4 20l1-4.2A8 8 0 1 1 20 12Z" />
  </svg>
);

/** Doble visto de WhatsApp (enviado). */
export const TicksGlyph = () => (
  <svg viewBox="0 0 18 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m1 6.5 3.2 3.2L10.5 2.5M6.6 9.7l.6.6 6.6-7.8" />
  </svg>
);

export const AlertGlyph = () => (
  <svg {...svg}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16h.01" />
  </svg>
);

export const DocGlyph = () => (
  <svg {...svg}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
  </svg>
);
