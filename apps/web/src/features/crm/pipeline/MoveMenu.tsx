import "./move-menu.css";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { StageSummary } from "@contracts/CrmContracts";

/**
 * «Mover a…»: la otra forma de cambiar de etapa (con teclado, lectores de
 * pantalla y en el celular, donde no se arrastra). Escape o tocar fuera lo cierra.
 */
export function MoveMenu({
  stages,
  currentStageId,
  label,
  onMove
}: {
  readonly stages: ReadonlyArray<StageSummary>;
  readonly currentStageId: string;
  readonly label: string;
  readonly onMove: (stageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const root = useRef<HTMLSpanElement>(null);

  /** Flota sobre la página (el tablero recorta lo que se sale): abajo del botón si cabe, si no arriba. */
  const toggle = () => {
    const rect = root.current?.getBoundingClientRect();
    if (rect) {
      const height = 48 + stages.length * 36;
      const below = rect.bottom + 6 + height <= window.innerHeight;
      setPlace({ position: "fixed", right: Math.max(8, window.innerWidth - rect.right), ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }) });
    }
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    // Al desplazarse se cierra (flota fijo y quedaría lejos de su tarjeta).
    const dismiss = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  return (
    <span className="move-menu" ref={root}>
      <button type="button" className="move-menu__trigger" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={toggle}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
      {open ? (
        <span className="move-menu__list" role="menu" style={place}>
          <span className="move-menu__title">Mover a</span>
          {stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              role="menuitem"
              className="move-menu__item"
              disabled={stage.id === currentStageId}
              onClick={() => {
                setOpen(false);
                onMove(stage.id);
              }}
            >
              <span className="move-menu__dot" style={{ background: stage.color }} aria-hidden="true" />
              {stage.name}
              {stage.id === currentStageId ? <span className="move-menu__here">aquí</span> : null}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
