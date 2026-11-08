import { useState } from "react";
import type { MessageItemKind } from "../types";
import { MESSAGE_ITEM_LABELS } from "../messageItems";
import { getItemIcon } from "./itemIcons";
import { setKindPayload } from "./dragPayload";

interface MessageLibraryProps {
  readonly kinds: ReadonlyArray<MessageItemKind>;
  readonly onAdd: (kind: MessageItemKind) => void;
}

/**
 * Bloques disponibles. Arrastrar o hacer clic (accesible por teclado). Todos se
 * presentan igual: qué partes ejecuta el motor no es información del usuario.
 */
export function MessageLibrary({ kinds, onAdd }: MessageLibraryProps) {
  const [dragged, setDragged] = useState<MessageItemKind | null>(null);

  return (
    <aside className="message-library">
      <p className="message-library__heading">Bloques</p>

      <ul className="message-library__list" aria-label="Bloques disponibles">
        {kinds.map((kind) => {
          const Icon = getItemIcon(kind);
          const label = MESSAGE_ITEM_LABELS[kind];

          return (
            <li key={kind} className="message-library__slot">
              <button
                type="button"
                className={`message-library__item message-library__item--${kind} nodrag${
                  dragged === kind ? " message-library__item--dragging" : ""
                }`}
                draggable
                onDragStart={(event) => {
                  setKindPayload(event.dataTransfer, kind);
                  setDragged(kind);
                }}
                onDragEnd={() => setDragged(null)}
                onClick={() => onAdd(kind)}
                aria-label={`Añadir ${label}`}
                title={`Añadir ${label}`}
              >
                <span className="message-library__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="message-library__label">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="message-library__note">Arrastra un bloque al contenido, o haz clic para añadirlo.</p>
    </aside>
  );
}
