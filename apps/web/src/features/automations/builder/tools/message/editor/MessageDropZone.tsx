interface MessageDropZoneProps {
  /** Un bloque arrastrado está sobre la zona. */
  readonly receiving: boolean;
  readonly onDragOver: () => void;
}

/**
 * Zona de continuación al final de la secuencia.
 *
 * Hay UNA, y está solo debajo del último bloque. No hay puntos de inserción
 * entre bloques: llenaban la secuencia de controles y competían con el
 * contenido, que es lo que el usuario viene a leer.
 *
 * NO es un botón. Es una superficie que espera, y por eso no lleva un «+»: el
 * signo pide que lo pulses, y lo que esta zona dice es «trae aquí lo siguiente».
 * El icono es una bandeja con una flecha que entra — la gramática de un destino
 * de arrastre, no la de un control.
 *
 * Respira despacio en reposo para no parecer un hueco muerto. Es la única
 * animación continua del editor y está detrás de `prefers-reduced-motion`.
 */
export function MessageDropZone({ receiving, onDragOver }: MessageDropZoneProps) {
  return (
    <li
      // Presentacional: vive dentro de la lista de bloques pero no es un
      // bloque. Sin esto, quien navegue con un lector oiría un elemento de
      // contenido que no existe.
      role="presentation"
      className={`message-drop${receiving ? " message-drop--receiving" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
    >
      <span className="message-drop__icon" aria-hidden="true">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          <path d="M10 3.2v7.4" />
          <path d="M6.9 7.6L10 10.7l3.1-3.1" />
          <path d="M3.4 12.4v2.7a1.7 1.7 0 0 0 1.7 1.7h9.8a1.7 1.7 0 0 0 1.7-1.7v-2.7" />
        </svg>
      </span>

      {/* Icono y texto en fila: apilados ocupaban el alto de otro bloque, y la
          zona pasaba a leerse como un hueco vacío grande en vez de como el
          final de la secuencia. */}
      <span className="message-drop__text">
        <span className="message-drop__title">
          {receiving ? "Suelta aquí" : "Arrastra aquí"}
        </span>
        <span className="message-drop__hint">
          {receiving ? "se añadirá al final" : "para seguir construyendo"}
        </span>
      </span>
    </li>
  );
}
