import "./message-actions.css";
import { useRef, useState } from "react";
import { QUICK_REACTIONS } from "@contracts/ConversationContracts";
import { FloatingMenu } from "./FloatingMenu";

/**
 * El menú de un mensaje (la flechita al pasar el mouse, como WhatsApp Web):
 * reaccionar, responder citándolo y copiar el texto.
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
  const [copied, setCopied] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  const act = (run: () => void) => {
    run();
    setOpen(false);
  };
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <button ref={button} type="button" className={`chat-msg-menu${open ? " is-open" : ""}`} aria-label="Opciones del mensaje" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      {open ? (
        <FloatingMenu anchor={button} label="Opciones del mensaje" width={228} onClose={() => setOpen(false)}>
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
            <button type="button" role="menuitem" className="floating-menu__item" onClick={() => act(onReply)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 8 5 12.5l5 4.5M5.5 12.5H14a5 5 0 0 1 5 5V19" /></svg>
              Responder
            </button>
          ) : null}
          {text ? (
            <button type="button" role="menuitem" className="floating-menu__item" onClick={() => act(copy)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></svg>
              Copiar texto
            </button>
          ) : null}
        </FloatingMenu>
      ) : null}
      {copied ? <span className="chat-copied" role="status">Copiado</span> : null}
    </>
  );
}
