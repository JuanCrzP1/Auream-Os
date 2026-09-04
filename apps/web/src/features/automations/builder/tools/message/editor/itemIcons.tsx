import type { ComponentType } from "react";
import type { MessageItemKind } from "../types";

// ---------------------------------------------------------------------------
// Iconografía de los bloques de un Mensaje.
//
// Frontera propia del módulo, separada de la lógica del constructor: el editor
// pide un icono por tipo y no sabe cómo está dibujado.
//
// Comparten el lenguaje visual de los iconos de la Toolbox del Builder —caja de
// 20, trazo de 1.7, remates y uniones redondos, sin relleno— para que el
// constructor no parezca de otra aplicación. Lo que cambia entre uno y otro es
// la FORMA, no el tratamiento: cada bloque tiene que reconocerse de un vistazo.
//
// NO se reutiliza `ToolUi.Icon`, que es el icono de una HERRAMIENTA del
// catálogo. Un bloque de un mensaje no es una herramienta: `interval` como
// bloque y el nodo Intervalo del lienzo son cosas distintas, y darles el mismo
// icono por venir del mismo registro las confundiría en la interfaz.
//
// `currentColor` en todo: el color lo decide el contexto, que es lo que permite
// que cada tipo tenga su acento sin que el icono lo sepa.
// ---------------------------------------------------------------------------

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Burbuja de conversación con líneas de texto. */
function TextItemIcon() {
  return (
    <Svg>
      <path d="M16.9 11.9a1.7 1.7 0 0 1-1.7 1.7H7.1L3.6 17V4.5a1.7 1.7 0 0 1 1.7-1.7h9.9a1.7 1.7 0 0 1 1.7 1.7z" />
      <line x1="6.5" y1="6.7" x2="14" y2="6.7" />
      <line x1="6.5" y1="9.7" x2="11.4" y2="9.7" />
    </Svg>
  );
}

/** Marco con sol y horizonte: la imagen, no un rectángulo cualquiera. */
function ImageItemIcon() {
  return (
    <Svg>
      <rect x="2.6" y="4.2" width="14.8" height="11.6" rx="2.2" />
      <circle cx="7" cy="8.2" r="1.35" />
      <path d="M3.1 14.7l4-3.6a1.5 1.5 0 0 1 2 0l2.9 2.6 1.5-1.3a1.5 1.5 0 0 1 2 0l1.8 1.6" />
    </Svg>
  );
}

/** Cuerpo de cámara con objetivo y visor lateral. */
function VideoItemIcon() {
  return (
    <Svg>
      <rect x="2.4" y="5.2" width="10.5" height="9.6" rx="2.2" />
      <path d="M12.9 9.2l3.4-1.9a.8.8 0 0 1 1.2.7v4a.8.8 0 0 1-1.2.7l-3.4-1.9z" />
      <circle cx="7.6" cy="10" r="1.9" />
    </Svg>
  );
}

/** Onda de audio simétrica. */
function AudioItemIcon() {
  return (
    <Svg>
      <line x1="3.3" y1="8.6" x2="3.3" y2="11.4" />
      <line x1="6.4" y1="6.2" x2="6.4" y2="13.8" />
      <line x1="9.5" y1="3.9" x2="9.5" y2="16.1" />
      <line x1="12.6" y1="6.9" x2="12.6" y2="13.1" />
      <line x1="15.7" y1="8.9" x2="15.7" y2="11.1" />
    </Svg>
  );
}

/** Documento con esquina doblada y renglones. */
function FileItemIcon() {
  return (
    <Svg>
      <path d="M4.8 4.1a1.6 1.6 0 0 1 1.6-1.6h4.3l4.5 4.5v9a1.6 1.6 0 0 1-1.6 1.6H6.4a1.6 1.6 0 0 1-1.6-1.6z" />
      <path d="M10.7 2.5v3.2a1.6 1.6 0 0 0 1.6 1.6h2.9" />
      <line x1="7.7" y1="11.4" x2="12.3" y2="11.4" />
      <line x1="7.7" y1="14.1" x2="10.5" y2="14.1" />
    </Svg>
  );
}

/** Reloj con corona: tiempo, no un círculo con dos rayas. */
function IntervalItemIcon() {
  return (
    <Svg>
      <circle cx="10" cy="11" r="6.5" />
      <path d="M10 7.6v3.4l2.3 1.4" />
      <line x1="8.1" y1="2.6" x2="11.9" y2="2.6" />
      <line x1="10" y1="2.6" x2="10" y2="4.5" />
    </Svg>
  );
}

const ITEM_ICONS: Readonly<Record<MessageItemKind, ComponentType>> = {
  text: TextItemIcon,
  image: ImageItemIcon,
  video: VideoItemIcon,
  audio: AudioItemIcon,
  file: FileItemIcon,
  interval: IntervalItemIcon
};

/** Icono de un tipo de bloque. Siempre devuelve algo pintable. */
export function getItemIcon(kind: MessageItemKind): ComponentType {
  return ITEM_ICONS[kind] ?? TextItemIcon;
}
