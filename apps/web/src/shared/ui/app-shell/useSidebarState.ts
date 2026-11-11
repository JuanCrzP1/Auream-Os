import { useCallback, useEffect, useState } from "react";

/** Donde se recuerda si la barra quedó contraída (solo en este navegador). */
const STORAGE_KEY = "auream.sidebar.collapsed";

/** Hasta este ancho la barra se esconde detrás de ☰ (igual que en `app-shell-mobile.css`). */
export const MOBILE_QUERY = "(max-width: 860px)";

const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeCollapsed = (collapsed: boolean) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Navegador privado o sin almacenamiento: solo dura esta visita.
  }
};

const isMobile = () => Boolean(window.matchMedia?.(MOBILE_QUERY).matches);

/** Escribiendo en un campo, Ctrl/⌘ + B es del campo (negrita), no de la barra. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * La barra lateral: en PC se contrae a íconos (y se recuerda); en celular se
 * abre y se cierra detrás de ☰. Ctrl/⌘ + B hace lo uno o lo otro según el ancho.
 */
export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      writeCollapsed(!current);
      return !current;
    });
  }, []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "b" || isTyping(event.target)) return;
      event.preventDefault();
      if (isMobile()) setMobileOpen((open) => !open);
      else toggleCollapsed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  // Al pasar de celular a PC, el menú abierto no se queda tapando la pantalla.
  useEffect(() => {
    const query = window.matchMedia?.(MOBILE_QUERY);
    if (!query) return;
    const onChange = () => !query.matches && setMobileOpen(false);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  return { collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile };
}
