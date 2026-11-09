import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ConnectionStatus } from "@contracts/ConnectionContracts";
import { BoltGlyph, DotsGlyph } from "./ConnectionGlyphs";
import { PencilGlyph, PulseGlyph, ReconnectGlyph, RestartGlyph, TrashGlyph, UnplugGlyph } from "./ConnectionMenuGlyphs";
import { connectionMenu, type ConnectionAction } from "./connectionActions";

const ICON: Readonly<Record<ConnectionAction, ReactNode>> = {
  link: <ReconnectGlyph />,
  restart: <RestartGlyph />,
  disconnect: <UnplugGlyph />,
  triggers: <BoltGlyph />,
  rename: <PencilGlyph />,
  delete: <TrashGlyph />
};

/** El menú «⋮» de una conexión: sus acciones según el estado, con icono, como en Leona. Se cierra con Escape o al hacer clic fuera. */
export function ConnectionActionsMenu({ name, status, onAction }: { readonly name: string; readonly status: ConnectionStatus; readonly onAction: (action: ConnectionAction) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="wa-card__menu" ref={ref}>
      <button type="button" className="wa-icon-btn" aria-label={`Más acciones de ${name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <DotsGlyph />
      </button>
      {open ? (
        <div className="wa-menu" role="menu">
          {connectionMenu(status).map((item) => (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              className={`wa-menu__item${item.tone ? ` wa-menu__item--${item.tone}` : ""}${item.separated ? " wa-menu__item--separated" : ""}`}
              onClick={() => {
                setOpen(false);
                onAction(item.action);
              }}
            >
              {item.action === "link" && status === "connected" ? <PulseGlyph /> : ICON[item.action]}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
