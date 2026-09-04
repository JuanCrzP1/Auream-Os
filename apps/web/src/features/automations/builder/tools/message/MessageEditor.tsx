import "./message-editor.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolEditorProps } from "../ToolUi";
import type { MessageItem, MessageItemKind } from "./types";
import {
  MESSAGE_ITEM_KINDS,
  appendItem,
  duplicateItem,
  insertItem,
  moveItem,
  removeItem,
  updateItem
} from "./messageItems";
import { readMessageItems } from "./readMessageConfig";
import { readKindPayload, readReorderPayload } from "./editor/dragPayload";
import { revealInViewport } from "./editor/revealInViewport";
import { MessageItemRow } from "./editor/MessageItemRow";
import { MessageLibrary } from "./editor/MessageLibrary";
import { MessageEmptyState } from "./editor/MessageEmptyState";
import { MessageDropZone } from "./editor/MessageDropZone";

/**
 * Constructor de la secuencia de bloques de un Mensaje.
 *
 * Recibe la configuración y una devolución de llamada; no conoce el nodo, ni el
 * lienzo, ni React Flow, ni el snapshot. Todo lo que puede hacer es proponer
 * una secuencia nueva.
 *
 * La secuencia se lee en cada render desde `config` en vez de guardarse en un
 * estado local. Con estado local habría dos verdades sobre lo mismo —la del
 * editor y la del nodo— y bastaría con deshacer, recargar o cerrar y reabrir
 * para que divergieran.
 *
 * Lo único que sí es estado local es lo que dura menos que un gesto: dónde está
 * el cursor mientras se arrastra y qué bloque acaba de nacer. Nada de eso es
 * configuración y nada de eso debe llegar al snapshot.
 */
export function MessageEditor({ draft, onChange }: ToolEditorProps) {
  const items = readMessageItems(draft.config, draft.content);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Publica una secuencia nueva y, si aparece un bloque, lo señala para
   * revelarlo.
   *
   * El bloque nuevo se detecta comparando identidades, no mirando qué operación
   * se ha hecho. Así añadir, soltar y duplicar revelan solos, mientras editar,
   * eliminar y reordenar no lo hacen nunca — porque no introducen identidades
   * nuevas. La regla «no desplazar al escribir» se cumple por construcción y no
   * porque alguien se acuerde de respetarla.
   *
   * Retira de paso el `content.text` heredado. Un nodo guardado antes de la
   * secuencia se lee como un bloque de texto, y si al editarlo dejáramos ahí el
   * campo viejo, la misma información quedaría en dos sitios para siempre: el
   * lector prefiere `items`, así que `text` se volvería un rastro muerto que
   * nadie actualiza y que contradice lo que el usuario ve. Se limpia en la
   * primera escritura, sin migración masiva y sin perder nada.
   */
  const commit = useCallback(
    (next: ReadonlyArray<MessageItem>) => {
      const previos = new Set(items.map((item) => item.id));
      const aparecido = next.find((item) => !previos.has(item.id));
      if (aparecido) setRevealId(aparecido.id);

      const { text: _heredado, ...restoDelContenido } = draft.content;

      onChange({
        content: restoDelContenido,
        config: { ...draft.config, items: next }
      });
    },
    [items, draft.content, draft.config, onChange]
  );

  /**
   * Lleva a la vista el bloque recién nacido.
   *
   * Se ejecuta en un efecto y no al añadirlo porque el elemento todavía no
   * existe en ese momento: la escritura sube al nodo, el nodo vuelve a bajar la
   * configuración y solo entonces hay algo a lo que desplazarse. Nada de
   * temporizadores — el disparador es que el bloque ya esté en el DOM.
   */
  useEffect(() => {
    if (!revealId) return;

    const viewport = scrollRef.current;
    const fila = viewport?.querySelector<HTMLElement>(`[data-item-id="${revealId}"]`);

    // Todavía no está en el DOM: la escritura acaba de subir al nodo y la
    // configuración aún no ha bajado. Se deja pendiente en lugar de darlo por
    // hecho, y este mismo efecto lo resuelve cuando el bloque exista — si se
    // limpiara aquí, el desplazamiento no llegaría a ocurrir nunca.
    if (!viewport || !fila) return;

    // El efecto corre cuando el DOM ya está actualizado, así que las medidas
    // del contenedor —su alto y el del contenido— son las definitivas.
    const alFinal = items[items.length - 1]?.id === revealId;
    const suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    revealInViewport(viewport, fila, alFinal, suave);
    setRevealId(null);
  }, [revealId, items]);

  const handleAdd = useCallback(
    (kind: MessageItemKind) => commit(appendItem(items, kind)),
    [commit, items]
  );

  /** Un bloque soltado sobre la secuencia: o llega nuevo, o se está moviendo. */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      // El lienzo también escucha `drop` para crear nodos. Se corta aquí para
      // que construir un mensaje no deje además un nodo suelto en el flujo.
      event.preventDefault();
      event.stopPropagation();

      const destino = dropIndex ?? items.length;
      setDropIndex(null);

      const nuevo = readKindPayload(event.dataTransfer);
      if (nuevo) {
        commit(insertItem(items, nuevo, destino));
        return;
      }

      const movido = readReorderPayload(event.dataTransfer);
      if (movido) {
        // Al mover, el hueco que deja el propio bloque desplaza el destino.
        const origen = items.findIndex((item) => item.id === movido);
        commit(moveItem(items, movido, origen < destino ? destino - 1 : destino));
      }
    },
    [commit, dropIndex, items]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    // Sin esto el navegador rechaza el soltar y el gesto no llega nunca.
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const arrastrando = dropIndex !== null;

  return (
    <div className="message-editor">
      <MessageLibrary kinds={MESSAGE_ITEM_KINDS} onAdd={handleAdd} />

      <section
        className={`message-builder${arrastrando ? " message-builder--receiving" : ""}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={(event) => {
          // Solo al salir del área entera: cruzar de un bloque a otro dispara
          // `dragleave` en el que se abandona y apagaría el indicador a mitad
          // del gesto.
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropIndex(null);
        }}
      >
        <p className="message-builder__heading">
          Contenido del mensaje
          <span className="message-builder__count">
            {items.length === 0
              ? "vacío"
              : `${items.length} ${items.length === 1 ? "bloque" : "bloques"}`}
          </span>
        </p>

        {/* Área desplazable. La cabecera del nodo y la biblioteca quedan fuera,
            así que permanecen fijas por muchos bloques que haya. */}
        <div className="message-builder__scroll nowheel" ref={scrollRef}>
          {items.length === 0 ? (
            <MessageEmptyState receiving={arrastrando} onDragOver={() => setDropIndex(0)} />
          ) : (
            <ol className="message-builder__list" aria-label="Contenidos del mensaje">
              {items.map((item, index) => (
                <MessageItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  total={items.length}
                  dropBefore={dropIndex === index}
                  onDragOverAt={setDropIndex}
                  onEdit={(change) => commit(updateItem(items, item.id, change))}
                  onRemove={() => commit(removeItem(items, item.id))}
                  onDuplicate={() => commit(duplicateItem(items, item.id))}
                  onMove={(toIndex) => commit(moveItem(items, item.id, toIndex))}
                />
              ))}

              {/* ÚNICA zona de continuación, y solo al final. Entre bloques no
                  hay nada: los controles intermedios competían con el contenido
                  y convertían la secuencia en una lista de botones. */}
              <MessageDropZone
                receiving={dropIndex === items.length}
                onDragOver={() => setDropIndex(items.length)}
              />
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
