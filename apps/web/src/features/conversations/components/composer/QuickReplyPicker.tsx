import "./quick-replies.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import type { QuickReply } from "@contracts/QuickReplyContracts";
import type { QuickRepliesStatus } from "@shared/quick-replies/useQuickReplies";
import { matchQuickReplies, pieceSummary } from "./quickReplyMatch";

export interface QuickReplyPickerHandle {
  /** Teclas desde el cuadro de texto («/saludo» + ↑ ↓ Enter Escape). Dice si las usó. */
  handleKey(event: KeyboardEvent): boolean;
}

interface Props {
  readonly replies: ReadonlyArray<QuickReply>;
  readonly status: QuickRepliesStatus;
  readonly canWrite: boolean;
  /** Lo buscado. Con `searchable` se escribe aquí; sin él, viene de «/…» en el chat. */
  readonly query: string;
  readonly searchable: boolean;
  readonly onQuery: (query: string) => void;
  readonly onPick: (reply: QuickReply) => void;
  readonly onNew: () => void;
  readonly onEdit: (reply: QuickReply) => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

/**
 * Respuestas rápidas sobre el compositor (como Leona): buscar por atajo o por
 * contenido, elegir con el mouse o con ↑ ↓ y Enter, crear una nueva y editar.
 */
export const QuickReplyPicker = forwardRef<QuickReplyPickerHandle, Props>(function QuickReplyPicker(props, ref) {
  const { replies, status, canWrite, query, searchable, onQuery, onPick, onNew, onEdit, onRetry, onClose } = props;
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const visible = matchQuickReplies(replies, query);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!box.current?.contains(target) && !target.closest("[data-quick-toggle], .ios-composer__input, .ui-overlay")) onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [onClose]);

  const handleKey = (event: KeyboardEvent): boolean => {
    if (event.key === "Escape") return (onClose(), true);
    if (visible.length === 0) return false;
    if (event.key === "ArrowDown") return (setActive((index) => (index + 1) % visible.length), true);
    if (event.key === "ArrowUp") return (setActive((index) => (index - 1 + visible.length) % visible.length), true);
    if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") return (onPick(visible[Math.min(active, visible.length - 1)]!), true);
    return false;
  };
  useImperativeHandle(ref, () => ({ handleKey }));

  return (
    <div className="chat-popover chat-quick" ref={box} role="dialog" aria-label="Respuestas rápidas">
      <header className="chat-quick__head">
        <h3 className="chat-popover__title">Respuestas rápidas</h3>
        {canWrite ? <button type="button" className="chat-quick__new" onClick={onNew}>+ Nueva</button> : null}
      </header>
      {searchable ? (
        <input
          className="chat-quick__search"
          type="search"
          value={query}
          autoFocus
          placeholder="Buscar por atajo o texto…"
          aria-label="Buscar respuesta rápida"
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => handleKey(event) && event.preventDefault()}
        />
      ) : null}
      <ul className="chat-quick__list" role="listbox" aria-label="Respuestas">
        {status === "loading" ? <li className="chat-quick__hint">Cargando…</li> : null}
        {status === "error" ? (
          <li className="chat-quick__hint">
            No se pudieron cargar. <button type="button" className="ios-link-btn" onClick={onRetry}>Reintentar</button>
          </li>
        ) : null}
        {status === "ready" && replies.length === 0 ? (
          <li className="chat-quick__hint">Aún no hay respuestas rápidas. {canWrite ? "Crea la primera con «+ Nueva»." : ""}</li>
        ) : null}
        {status === "ready" && replies.length > 0 && visible.length === 0 ? <li className="chat-quick__hint">Ninguna coincide con «{query}».</li> : null}
        {visible.map((reply, index) => (
          <li key={reply.id} data-index={index} role="option" aria-selected={index === active} className={`chat-quick__item${index === active ? " is-active" : ""}`} onMouseEnter={() => setActive(index)}>
            <button type="button" className="chat-quick__pick" onClick={() => onPick(reply)}>
              <strong>/{reply.shortcut}</strong>
              <span>{reply.pieces.map(pieceSummary).join(" · ")}</span>
              {reply.pieces.length > 1 ? <em>{reply.pieces.length} mensajes</em> : null}
            </button>
            {canWrite ? (
              <button type="button" className="chat-quick__edit" aria-label={`Editar /${reply.shortcut}`} title="Editar" onClick={() => onEdit(reply)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" /></svg>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="chat-quick__foot">Escribe <kbd>/</kbd> en el chat para buscarlas · <kbd>↑</kbd> <kbd>↓</kbd> y <kbd>Enter</kbd> para elegir</p>
    </div>
  );
});
