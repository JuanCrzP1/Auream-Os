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

/** Registrar venta: una etiqueta de precio. */
export const SaleGlyph = () => (
  <svg {...svg}>
    <path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2a1.5 1.5 0 0 1 1 .44l7.3 7.3a1.5 1.5 0 0 1 0 2.12l-7.2 7.2a1.5 1.5 0 0 1-2.12 0l-7.3-7.3a1.5 1.5 0 0 1-.38-1.06Z" />
    <circle cx="8.2" cy="8.2" r="1.4" />
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

/** Un chulo: salió hacia WhatsApp (aún no llega al teléfono del cliente). */
export const SentGlyph = () => (
  <svg viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m2.5 5.8 3 3L12 2.2" />
  </svg>
);

/** Dos chulos: llegó al teléfono del cliente (grises) o lo leyó (azules, por CSS). */
export const DeliveredGlyph = () => (
  <svg viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m.8 5.8 3 3L10.3 2.2" />
    <path d="m7.4 8.4.4.4 6.5-6.6" />
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

export const FilterGlyph = () => (
  <svg {...svg}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

export const InfoGlyph = () => (
  <svg {...svg}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </svg>
);

export const CloseGlyph = () => (
  <svg {...svg} strokeWidth={2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const TagGlyph = () => (
  <svg {...svg}>
    <path d="M3 12V4h8l9.3 9.3a1.5 1.5 0 0 1 0 2.1l-5.9 5.9a1.5 1.5 0 0 1-2.1 0Z" />
    <path d="M7.5 8h.01" />
  </svg>
);

export const CalendarGlyph = () => (
  <svg {...svg}>
    <rect x="4" y="5" width="16" height="15" rx="2.5" />
    <path d="M4 10h16M8.5 3v4M15.5 3v4" />
  </svg>
);

export const PhoneGlyph = () => (
  <svg {...svg}>
    <path d="M6.6 3.5h2.6l1.5 4-2 1.3a10.5 10.5 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  </svg>
);

export const CheckGlyph = () => (
  <svg {...svg} strokeWidth={2.2}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
