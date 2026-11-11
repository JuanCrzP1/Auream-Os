import "./message-actions.css";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QUICK_REACTIONS } from "@contracts/ConversationContracts";

const MENU_WIDTH = 228;

/**
 * El menú de un mensaje (la flechita al pasar el mouse, como WhatsApp Web):
 * responder citándolo, reaccionar y copiar el texto. Se abre en una capa
 * propia para que el hilo con scroll no lo corte.
 */
export function MessageActions({
  text,
  reaction,
  onReply,
  onReact
}: {
  readonly text: string;
  /** Emoji que ya le puso el equipo (tocarlo otra vez lo quita). */
  readonly reaction: string | undefined;
  readonly onReply?: () => void;
  readonly onReact?: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const rect = button.current!.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 180;
    const below = rect.bottom + 6 + height < window.innerHeight;
    setPlace({
      top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height),
      left: Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8)
    });
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (menu.current?.contains(event.target as Node) || button.current?.contains(event.target as Node))) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const act = (run: () => void) => {
    run();
    setOpen(false);
  };

  return (
    <>
      <button ref={button} type="button" className={`chat-msg-menu${open ? " is-open" : ""}`} aria-label="Opciones del mensaje" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      {open
        ? createPortal(
            <div ref={menu} className="chat-actions" role="menu" aria-label="Opciones del mensaje" style={{ top: place?.top ?? -9999, left: place?.left ?? -9999, width: MENU_WIDTH }}>
              {onReact ? (
                <div className="chat-actions__reactions" role="group" aria-label="Reaccionar">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button key={emoji} type="button" role="menuitem" className={reaction === emoji ? "is-on" : ""} aria-label={reaction === emoji ? `Quitar ${emoji}` : `Reaccionar ${emoji}`} onClick={() => act(() => onReact(reaction === emoji ? "" : emoji))}>
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
              {onReply ? (
                <button type="button" role="menuitem" className="chat-actions__item" onClick={() => act(onReply)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 8 5 12.5l5 4.5M5.5 12.5H14a5 5 0 0 1 5 5V19" /></svg>
                  Responder
                </button>
              ) : null}
              {text ? (
                <button
                  type="button"
                  role="menuitem"
                  className="chat-actions__item"
                  onClick={() => {
                    void navigator.clipboard?.writeText(text).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    });
                    setOpen(false);
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></svg>
                  Copiar texto
                </button>
              ) : null}
            </div>,
            document.body
          )
        : null}
      {copied ? <span className="chat-copied" role="status">Copiado</span> : null}
    </>
  );
}
