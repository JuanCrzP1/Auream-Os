import "./sidebar-popover.css";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * La ventana de la campana o de soporte: se abre HACIA ARRIBA desde la
 * tarjeta de la cuenta y ocupa todo el ancho del menú, igual que el menú del
 * perfil. Se cierra con Escape o tocando fuera.
 */
export function SidebarPopover({ anchor, label, onClose, children }: { readonly anchor: RefObject<HTMLElement>; readonly label: string; readonly onClose: () => void; readonly children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={box} className="sidebar-popover" role="dialog" aria-label={label}>
      {children}
    </div>
  );
}
