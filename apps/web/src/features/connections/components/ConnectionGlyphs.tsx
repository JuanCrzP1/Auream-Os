// Iconos propios del módulo (trazo, sin logos de marca). Decorativos: quien
// los usa pone el texto accesible al lado.

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

/** Burbuja de chat con teléfono: un número de WhatsApp. */
export function ChatPhoneGlyph() {
  return (
    <svg {...svg}>
      <path d="M12 3.5a8.5 8.5 0 0 0-7.36 12.75L3.5 20.5l4.38-1.12A8.5 8.5 0 1 0 12 3.5Z" />
      <path d="M9.2 8.6c.2-.4.6-.4.8-.1l.9 1.4c.2.3.1.6-.1.8l-.5.5a6 6 0 0 0 2.5 2.5l.5-.5c.2-.2.5-.3.8-.1l1.4.9c.3.2.3.6-.1.8-.9.7-2 .9-3.3.2a8.6 8.6 0 0 1-3.4-3.4c-.7-1.3-.5-2.4.2-3.3Z" />
    </svg>
  );
}

export function QrGlyph() {
  return (
    <svg {...svg}>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1.2" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1.2" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1.2" />
      <path d="M14.5 14.5h2.5v2.5M20.5 14.5v2M14.5 20.5h2M19 19h1.5v1.5" />
    </svg>
  );
}

/** Escudo con visto: la conexión oficial. */
export function OfficialGlyph() {
  return (
    <svg {...svg}>
      <path d="M12 3.2 5 6v5.4c0 4.3 2.9 7.7 7 9.4 4.1-1.7 7-5.1 7-9.4V6l-7-2.8Z" />
      <path d="m8.8 12.2 2.2 2.2 4.2-4.4" />
    </svg>
  );
}

export function PlusGlyph() {
  return (
    <svg {...svg} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function DotsGlyph() {
  return (
    <svg {...svg} strokeWidth={2.4}>
      <path d="M12 6h.01M12 12h.01M12 18h.01" />
    </svg>
  );
}

export function LinkGlyph() {
  return (
    <svg {...svg}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  );
}
