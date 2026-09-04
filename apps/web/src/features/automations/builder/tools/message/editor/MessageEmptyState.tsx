import { MessageIcon } from "../MessageIcon";

interface MessageEmptyStateProps {
  /** El usuario está arrastrando un bloque sobre el constructor. */
  readonly receiving: boolean;
  readonly onDragOver: () => void;
}

/**
 * Constructor sin bloques.
 *
 * Dice qué hacer y con qué gesto, porque es el único momento en que el usuario
 * no tiene nada de lo que deducirlo. Reutiliza el icono de la propia
 * herramienta —no uno inventado— para que se lea como «este mensaje está
 * vacío» y no como un aviso del sistema.
 *
 * Es también zona de caída: el hueco vacío es el sitio más natural donde
 * soltar el primer bloque, y no responder a ese gesto obligaría a apuntar a un
 * borde invisible.
 */
export function MessageEmptyState({ receiving, onDragOver }: MessageEmptyStateProps) {
  return (
    <div
      className={`message-empty${receiving ? " message-empty--receiving" : ""}`}
      onDragOver={onDragOver}
    >
      <span className="message-empty__icon" aria-hidden="true">
        <MessageIcon />
      </span>
      <p className="message-empty__title">Construye tu mensaje</p>
      <p className="message-empty__hint">
        Arrastra un bloque desde la izquierda o haz clic para agregarlo.
      </p>
    </div>
  );
}
