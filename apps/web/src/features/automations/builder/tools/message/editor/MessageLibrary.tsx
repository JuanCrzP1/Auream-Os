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
 * Bloques que se pueden añadir a un mensaje.
 *
 * Dos formas de usarlo, a propósito: ARRASTRAR al constructor, que es el gesto
 * natural de construir algo, y HACER CLIC, que hace lo mismo y además funciona
 * con teclado. El arrastre es la vía visual; el clic es la que garantiza que
 * nadie se quede fuera.
 *
 * Todos los bloques se presentan igual. Qué partes del motor están construidas
 * es información de desarrollo: el usuario está decidiendo qué dirá su mensaje,
 * no auditando la infraestructura. Esa distinción sigue existiendo —el runtime
 * la respeta y deja constancia de lo que no entrega— pero no se le enseña aquí.
 *
 * La columna no desplaza: mientras el constructor crece, la biblioteca queda
 * quieta y a mano.
 */
export function MessageLibrary({ kinds, onAdd }: MessageLibraryProps) {
  // Qué bloque se está arrastrando. Dura menos que el gesto y no sale de aquí:
  // sirve para que el usuario vea de dónde salió lo que lleva en la mano.
  const [arrastrado, setArrastrado] = useState<MessageItemKind | null>(null);

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
                  arrastrado === kind ? " message-library__item--dragging" : ""
                }`}
                draggable
                onDragStart={(event) => {
                  setKindPayload(event.dataTransfer, kind);
                  setArrastrado(kind);
                }}
                onDragEnd={() => setArrastrado(null)}
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

      {/* Cierra la columna por abajo. Sin esto, los seis bloques quedaban
          arriba y el resto era un vacío sin explicar. Es una nota, no un aviso:
          tipografía secundaria y una separación fina que la ancla al pie. */}
      <p className="message-library__note">
        Arrastra un bloque al contenido, o haz clic para añadirlo.
      </p>
    </aside>
  );
}
