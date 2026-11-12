import { useEffect, useRef, useState } from "react";

/**
 * Qué panel de la barra está abierto (uno a la vez). Se cierra con Escape o
 * tocando fuera de la barra.
 */
export function usePopover<T extends string>() {
  const [open, setOpen] = useState<T | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const toggle = (id: T) => setOpen((current) => (current === id ? null : id));
  return { open, setOpen, toggle, ref };
}
