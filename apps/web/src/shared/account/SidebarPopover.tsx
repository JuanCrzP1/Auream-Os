import "./sidebar-popover.css";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * La ventana de la campana o de soporte: se abre AL LADO de la barra lateral,
 * con su borde de abajo alineado con el botón que la abrió (crece hacia
 * arriba desde ahí), con más ancho que el menú para que los avisos se lean
 * en dos renglones. En celular es una hoja que sube desde abajo, a todo el
 * ancho, con su ✕. Se cierra con Escape o tocando fuera.
 */
export function SidebarPopover({ anchor, label, onClose, children }: { readonly anchor: RefObject<HTMLElement>; readonly label: string; readonly onClose: () => void; readonly children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    const sidebar = anchor.current?.closest(".app-sidebar") ?? anchor.current;
    const rect = sidebar?.getBoundingClientRect();
    const button = anchor.current?.getBoundingClientRect();
    if (rect && button) setPlace({ left: rect.right + 12, bottom: Math.max(12, window.innerHeight - button.bottom) });
  }, [anchor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        anchor.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!box.current?.contains(target) && !anchor.current?.contains(target)) onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [anchor, onClose]);

  // Se dibuja en la página, no dentro del menú: así nada del menú la recorta ni la corre.
  return createPortal(
    <>
      {/* En celular: el fondo oscuro detrás de la hoja (tocarlo la cierra). */}
      <div className="sidebar-popover__scrim" aria-hidden="true" />
      <div ref={box} className="sidebar-popover" role="dialog" aria-label={label} style={place ?? undefined}>
        <span className="sidebar-popover__grip" aria-hidden="true" />
        <button type="button" className="sidebar-popover__close" aria-label={`Cerrar ${label.toLowerCase()}`} onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        {children}
      </div>
    </>,
    document.body
  );
}
