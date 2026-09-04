import { useState } from "react";
import type { MessageItem } from "../types";
import type { MessageItemChange } from "../messageItems";
import { MESSAGE_ITEM_LABELS } from "../messageItems";
import { getItemIcon } from "./itemIcons";
import { setReorderPayload } from "./dragPayload";
import { TextItemEditor } from "./TextItemEditor";
import { MediaItemEditor } from "./MediaItemEditor";
import { IntervalItemEditor } from "./IntervalItemEditor";

interface MessageItemRowProps {
  readonly item: MessageItem;
  readonly index: number;
  readonly total: number;
  readonly dropBefore: boolean;
  readonly onDragOverAt: (index: number) => void;
  readonly onEdit: (change: MessageItemChange) => void;
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  readonly onMove: (toIndex: number) => void;
}

/**
 * Un bloque de la secuencia.
 *
 * La BARRA es común a todos —asa, icono, tipo, acciones— y el CUERPO lo pone
 * cada tipo: un texto no se edita como una imagen, y forzar los dos en el mismo
 * campo fue lo que hacía que la primera versión pareciera un formulario.
 *
 * El reparto por tipo es un `switch` sobre los bloques de Mensaje, dentro del
 * módulo de Mensaje. No es una fuga: lo que no puede existir es un reparto por
 * tipo de NODO fuera de la herramienta.
 *
 * Se reordena de dos formas, y las dos importan: ARRASTRANDO, que es lo que se
 * espera al ver una lista de bloques, y con SUBIR y BAJAR, que hacen lo mismo y
 * funcionan con teclado. El arrastre complementa la accesibilidad; no la
 * sustituye.
 *
 * Todo control lleva `nodrag`: sin esa clase, cualquier gesto aquí dentro
 * movería el nodo entero por el lienzo.
 */
export function MessageItemRow({
  item,
  index,
  total,
  dropBefore,
  onDragOverAt,
  onEdit,
  onRemove,
  onDuplicate,
  onMove
}: MessageItemRowProps) {
  const [dragging, setDragging] = useState(false);
  const Icon = getItemIcon(item.kind);
  const label = MESSAGE_ITEM_LABELS[item.kind];
  const position = index + 1;

  const classes = [
    "message-item",
    `message-item--${item.kind}`,
    dragging ? "message-item--dragging" : "",
    dropBefore ? "message-item--drop-before" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      className={classes}
      data-item-id={item.id}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOverAt(index);
      }}
    >
      <div className="message-item__bar">
        <span
          className="message-item__grip nodrag"
          draggable
          onDragStart={(event) => {
            setReorderPayload(event.dataTransfer, item.id);
            setDragging(true);
          }}
          onDragEnd={() => setDragging(false)}
          aria-hidden="true"
          title="Arrastra para reordenar"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" focusable="false">
            <circle cx="6" cy="4" r="1.25" />
            <circle cx="10" cy="4" r="1.25" />
            <circle cx="6" cy="8" r="1.25" />
            <circle cx="10" cy="8" r="1.25" />
            <circle cx="6" cy="12" r="1.25" />
            <circle cx="10" cy="12" r="1.25" />
          </svg>
        </span>

        <span className="message-item__icon" aria-hidden="true">
          <Icon />
        </span>
        <span className="message-item__kind">{label}</span>

        <div className="message-item__actions">
          <button
            type="button"
            className="message-item__action nodrag"
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            title="Subir"
            aria-label={`Subir ${label}`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 12V4M4.5 7.5L8 4l3.5 3.5" />
            </svg>
          </button>
          <button
            type="button"
            className="message-item__action nodrag"
            onClick={() => onMove(index + 1)}
            disabled={index === total - 1}
            title="Bajar"
            aria-label={`Bajar ${label}`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 4v8M4.5 8.5L8 12l3.5-3.5" />
            </svg>
          </button>
          <button
            type="button"
            className="message-item__action nodrag"
            onClick={onDuplicate}
            title="Duplicar"
            aria-label={`Duplicar ${label}`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 3.5h-7a1 1 0 0 0-1 1v7" />
            </svg>
          </button>
          <button
            type="button"
            className="message-item__action message-item__action--remove nodrag"
            onClick={onRemove}
            title="Eliminar"
            aria-label={`Eliminar ${label}`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {item.kind === "text" ? (
        <TextItemEditor item={item} position={position} onEdit={onEdit} />
      ) : item.kind === "interval" ? (
        <IntervalItemEditor item={item} position={position} onEdit={onEdit} />
      ) : (
        <MediaItemEditor item={item} position={position} onEdit={onEdit} />
      )}
    </li>
  );
}
