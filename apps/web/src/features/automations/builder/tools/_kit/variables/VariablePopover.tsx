import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const WIDTH = 300;
const GAP = 6;

/**
 * La lista de variables en una capa propia, encima de todo: el bloque del
 * lienzo o el panel con scroll no la cortan. Abajo del campo si cabe, si no
 * arriba; alineada a su derecha. Lleva el color del bloque. Se cierra con
 * Escape, al tocar fuera, al hacer scroll fuera de ella o al cambiar el
 * tamaño de la ventana.
 */
export function VariablePopover({ anchor, onClose, children }: { readonly anchor: RefObject<HTMLElement | null>; readonly onClose: () => void; readonly children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  // El padre la recrea en cada pintada: se guarda para no volver a medir por eso.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [place, setPlace] = useState<{ top: number; left: number; accent: string } | null>(null);

  useLayoutEffect(() => {
    const element = anchor.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const height = panel.current?.offsetHeight ?? 320;
    const below = rect.bottom + GAP + height < window.innerHeight;
    setPlace({
      top: below ? rect.bottom + GAP : Math.max(8, rect.top - GAP - height),
      left: Math.min(Math.max(8, rect.right - WIDTH), window.innerWidth - WIDTH - 8),
      accent: getComputedStyle(element).getPropertyValue("--kit-accent").trim()
    });
    // Escape cierra solo la lista, no el editor del bloque que está debajo.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current();
    };
    const close = (event: Event) => {
      const target = event.target as Node;
      if (event.type === "pointerdown" && (panel.current?.contains(target) || element.contains(target))) return;
      if (event.type === "scroll" && panel.current?.contains(target)) return;
      closeRef.current();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [anchor]);

  const style = { top: place?.top ?? -9999, left: place?.left ?? -9999, width: WIDTH, ...(place?.accent ? { "--kit-accent": place.accent } : {}) } as CSSProperties;
  return createPortal(
    <div ref={panel} className="kit-variables nodrag nowheel" role="dialog" aria-label="Elegir una variable" style={style}>
      {children}
    </div>,
    document.body
  );
}
