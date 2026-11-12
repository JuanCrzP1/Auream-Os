import "./floating-menu.css";
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * Un menú que se abre junto a su botón en una capa propia (el hilo con
 * scroll o la cabecera no lo cortan): abajo si cabe, si no arriba; alineado a
 * la derecha del botón. Se cierra con Escape, al tocar fuera, al hacer
 * scroll o al cambiar el tamaño de la ventana.
 */
export function FloatingMenu({
  anchor,
  label,
  width,
  onClose,
  children
}: {
  readonly anchor: RefObject<HTMLElement | null>;
  readonly label: string;
  readonly width: number;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    const height = menu.current?.offsetHeight ?? 200;
    const below = rect.bottom + 6 + height < window.innerHeight;
    setPlace({
      top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height),
      left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
    });
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      const target = event.target as Node;
      if (event.type === "pointerdown" && (menu.current?.contains(target) || anchor.current?.contains(target))) return;
      if (event.type === "scroll" && menu.current?.contains(target)) return;
      onClose();
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
  }, [anchor, onClose, width]);

  return createPortal(
    <div ref={menu} className="floating-menu" role="menu" aria-label={label} style={{ top: place?.top ?? -9999, left: place?.left ?? -9999, width }}>
      {children}
    </div>,
    document.body
  );
}
