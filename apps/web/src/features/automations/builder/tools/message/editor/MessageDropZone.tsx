interface MessageDropZoneProps {
  readonly receiving: boolean;
  readonly onDragOver: () => void;
}

/**
 * Única zona de continuación, al final de la secuencia. Una superficie que
 * espera (bandeja con flecha), no un botón «+».
 */
export function MessageDropZone({ receiving, onDragOver }: MessageDropZoneProps) {
  return (
    <li
      // Vive en la lista de bloques pero no es un bloque.
      role="presentation"
      className={`message-drop${receiving ? " message-drop--receiving" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
    >
      <span className="message-drop__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="M10 3.2v7.4" />
          <path d="M6.9 7.6L10 10.7l3.1-3.1" />
          <path d="M3.4 12.4v2.7a1.7 1.7 0 0 0 1.7 1.7h9.8a1.7 1.7 0 0 0 1.7-1.7v-2.7" />
        </svg>
      </span>

      <span className="message-drop__text">
        <span className="message-drop__title">{receiving ? "Suelta aquí" : "Arrastra aquí"}</span>
        <span className="message-drop__hint">{receiving ? "se añadirá al final" : "para seguir construyendo"}</span>
      </span>
    </li>
  );
}
