import { MessageIcon } from "../MessageIcon";

interface MessageEmptyStateProps {
  /** Hay un bloque arrastrándose sobre el constructor. */
  readonly receiving: boolean;
  readonly onDragOver: () => void;
}

/** Constructor vacío: explica el gesto y es también zona de caída del primer bloque. */
export function MessageEmptyState({ receiving, onDragOver }: MessageEmptyStateProps) {
  return (
    <div className={`message-empty${receiving ? " message-empty--receiving" : ""}`} onDragOver={onDragOver}>
      <span className="message-empty__icon" aria-hidden="true">
        <MessageIcon />
      </span>
      <p className="message-empty__title">Construye tu mensaje</p>
      <p className="message-empty__hint">Arrastra un bloque desde la izquierda o haz clic para agregarlo.</p>
    </div>
  );
}
