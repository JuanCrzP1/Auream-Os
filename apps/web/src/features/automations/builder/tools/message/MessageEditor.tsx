import "./message-editor.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolEditorProps } from "../ToolUi";
import { editorAccent } from "../_kit/fields";
import { EditorIntro } from "../_kit/layout";
import { messageTool } from "./definition";
import { MessageIcon } from "./MessageIcon";
import type { MessageItem, MessageItemKind } from "./types";
import {
  MESSAGE_ITEM_KINDS,
  appendItem,
  duplicateItem,
  insertItem,
  moveItem,
  removeItem,
  updateItem,
} from "./messageItems";
import { releaseFile } from "./mediaSourceSession";
import { readMessageItems } from "./readMessageConfig";
import { readKindPayload, readReorderPayload } from "./editor/dragPayload";
import { revealInViewport } from "./editor/revealInViewport";
import { MessageItemRow } from "./editor/MessageItemRow";
import { MessageLibrary } from "./editor/MessageLibrary";
import { MessageEmptyState } from "./editor/MessageEmptyState";
import { MessageDropZone } from "./editor/MessageDropZone";
import { MediaUploadProvider } from "./editor/MediaUploadContext";

/**
 * Constructor de la secuencia de un Mensaje. La secuencia se lee de `config`
 * en cada render; solo es estado local lo que dura menos que un gesto (posición
 * del arrastre, bloque recién creado), que nunca llega al snapshot.
 */
export function MessageEditor({ draft, onChange, resources }: ToolEditorProps) {
  const items = readMessageItems(draft.config, draft.content);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Publica la secuencia. Un id nuevo se revela (añadir, soltar, duplicar);
   * editar, borrar y reordenar no introducen ids y no desplazan, por
   * construcción. Retira el `content.text` heredado en la primera escritura
   * para que la información no quede en dos sitios.
   */
  const commit = useCallback(
    (next: ReadonlyArray<MessageItem>) => {
      const previous = new Set(items.map((item) => item.id));
      const created = next.find((item) => !previous.has(item.id));
      if (created) setRevealId(created.id);

      const { text: _legacy, ...restContent } = draft.content;

      onChange({
        content: restContent,
        config: { ...draft.config, items: next },
      });
    },
    [items, draft.content, draft.config, onChange],
  );

  /**
   * Lleva a la vista el bloque recién creado cuando ya está en el DOM (la
   * escritura sube al nodo y la configuración vuelve a bajar). Si aún no está,
   * queda pendiente y este efecto lo resuelve en el siguiente render.
   */
  useEffect(() => {
    if (!revealId) return;

    const viewport = scrollRef.current;
    const row = viewport?.querySelector<HTMLElement>(
      `[data-item-id="${revealId}"]`,
    );
    if (!viewport || !row) return;

    const isLast = items[items.length - 1]?.id === revealId;
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches;

    revealInViewport(viewport, row, isLast, smooth);
    setRevealId(null);
  }, [revealId, items]);

  const handleAdd = useCallback(
    (kind: MessageItemKind) => commit(appendItem(items, kind)),
    [commit, items],
  );

  /** Un bloque soltado: o llega nuevo desde la biblioteca, o se está moviendo. */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      // El lienzo también escucha `drop` para crear nodos.
      event.preventDefault();
      event.stopPropagation();

      const target = dropIndex ?? items.length;
      setDropIndex(null);

      const created = readKindPayload(event.dataTransfer);
      if (created) {
        commit(insertItem(items, created, target));
        return;
      }

      const movedId = readReorderPayload(event.dataTransfer);
      if (movedId) {
        // El hueco que deja el propio bloque desplaza el destino.
        const from = items.findIndex((item) => item.id === movedId);
        commit(moveItem(items, movedId, from < target ? target - 1 : target));
      }
    },
    [commit, dropIndex, items],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const dragging = dropIndex !== null;

  return (
    <MediaUploadProvider value={resources?.uploadMedia}>
    <div
      className="message-shell"
      style={editorAccent(messageTool.colors.header)}
    >
      <EditorIntro
        compact
        Icon={MessageIcon}
        title="Mensaje"
        description="Construye lo que recibe el cliente: textos, imágenes, videos, audios, archivos y pausas, en orden."
        outputs={null}
      />
      <div className="message-editor">
        <MessageLibrary kinds={MESSAGE_ITEM_KINDS} onAdd={handleAdd} />

        <section
          className={`message-builder${dragging ? " message-builder--receiving" : ""}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={(event) => {
            // Solo al salir del área entera, no al cruzar entre bloques.
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setDropIndex(null);
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

          <div className="message-builder__scroll nowheel" ref={scrollRef}>
            {items.length === 0 ? (
              <MessageEmptyState
                receiving={dragging}
                onDragOver={() => setDropIndex(0)}
              />
            ) : (
              <ol
                className="message-builder__list"
                aria-label="Contenidos del mensaje"
              >
                {items.map((item, index) => (
                  <MessageItemRow
                    key={item.id}
                    item={item}
                    index={index}
                    total={items.length}
                    dropBefore={dropIndex === index}
                    onDragOverAt={setDropIndex}
                    onEdit={(change) =>
                      commit(updateItem(items, item.id, change))
                    }
                    // Borrar el bloque libera su archivo. No en un efecto de
                    // desmontaje: cerrar el editor también desmonta y ahí el
                    // archivo debe sobrevivir.
                    onRemove={() => {
                      releaseFile(item.id);
                      commit(removeItem(items, item.id));
                    }}
                    onDuplicate={() => commit(duplicateItem(items, item.id))}
                    onMove={(toIndex) =>
                      commit(moveItem(items, item.id, toIndex))
                    }
                  />
                ))}

                <MessageDropZone
                  receiving={dropIndex === items.length}
                  onDragOver={() => setDropIndex(items.length)}
                />
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
    </MediaUploadProvider>
  );
}
