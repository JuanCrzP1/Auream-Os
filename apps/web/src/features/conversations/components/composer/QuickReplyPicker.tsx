import "./quick-picker.css";
import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { QuickReply } from "@contracts/QuickReplyContracts";
import type { QuickRepliesStatus } from "@shared/quick-replies/useQuickReplies";
import { groupByCategory, matchQuickReplies, pieceSummary } from "../../quick-replies/quickReplyText";

export interface QuickReplyPickerHandle {
  /** Teclas desde el cuadro de texto («/saludo» + ↑ ↓ Enter Escape). Dice si las usó. */
  handleKey(event: KeyboardEvent): boolean;
}

/** Donde se organizan (Configuración › Respuestas rápidas). */
export const QUICK_REPLIES_SETTINGS = "/settings/quick-replies";

interface Props {
  readonly replies: ReadonlyArray<QuickReply>;
  readonly status: QuickRepliesStatus;
  /** Quien mira las organiza: ve «Administrar respuestas». */
  readonly canManage: boolean;
  /** Lo buscado. Con `searchable` se escribe aquí; sin él, viene de «/…» en el chat. */
  readonly query: string;
  readonly searchable: boolean;
  readonly onQuery: (query: string) => void;
  readonly onPick: (reply: QuickReply) => void;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

/**
 * Respuestas rápidas sobre el compositor: solo buscar y enviar. Agrupadas por
 * categoría; se eligen con el mouse o con ↑ ↓ y Enter. Se crean y editan en
 * Configuración.
 */
export const QuickReplyPicker = forwardRef<QuickReplyPickerHandle, Props>(function QuickReplyPicker(props, ref) {
  const { replies, status, canManage, query, searchable, onQuery, onPick, onRetry, onClose } = props;
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const groups = groupByCategory(matchQuickReplies(replies, query));
  const visible = groups.flatMap((group) => group.replies);
  const grouped = groups.length > 1;

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!box.current?.contains(target) && !target.closest("[data-quick-toggle], .ios-composer__input")) onClose();
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

  let index = -1;
  return (
    <div className="chat-popover chat-quick" ref={box} role="dialog" aria-label="Respuestas rápidas">
      <header className="chat-quick__head">
        <h3 className="chat-popover__title">Respuestas rápidas</h3>
        {canManage ? <Link className="chat-quick__manage" to={QUICK_REPLIES_SETTINGS}>Administrar →</Link> : null}
      </header>
      {searchable ? (
        <input
          className="chat-quick__search"
          type="search"
          value={query}
          autoFocus
          placeholder="Buscar por atajo, categoría o texto…"
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
          <li className="chat-quick__hint">
            {canManage ? (
              <>Aún no hay respuestas rápidas. <Link to={QUICK_REPLIES_SETTINGS}>Crea la primera en Configuración</Link>.</>
            ) : (
              "Aún no hay respuestas rápidas. Las crean los dueños y administradores en Configuración."
            )}
          </li>
        ) : null}
        {status === "ready" && replies.length > 0 && visible.length === 0 ? <li className="chat-quick__hint">Ninguna coincide con «{query}».</li> : null}
        {groups.map((group) => (
          <Fragment key={group.category}>
            {grouped ? <li className="chat-quick__group" role="presentation">{group.category}</li> : null}
            {group.replies.map((reply) => {
              index += 1;
              const at = index;
              return (
                <li key={reply.id} data-index={at} role="option" aria-selected={at === active} className={`chat-quick__item${at === active ? " is-active" : ""}`} onMouseEnter={() => setActive(at)}>
                  <button type="button" className="chat-quick__pick" onClick={() => onPick(reply)}>
                    <strong>/{reply.shortcut}</strong>
                    <span>{reply.pieces.map(pieceSummary).join(" · ")}</span>
                    {reply.pieces.length > 1 ? <em>{reply.pieces.length} mensajes</em> : null}
                  </button>
                </li>
              );
            })}
          </Fragment>
        ))}
      </ul>
      <p className="chat-quick__foot">Escribe <kbd>/</kbd> en el chat para buscarlas · <kbd>↑</kbd> <kbd>↓</kbd> y <kbd>Enter</kbd> para enviar</p>
    </div>
  );
});
