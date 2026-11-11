// El panel de ayuda de cada pantalla se abre desde otro lado (la diadema de
// soporte): un evento del navegador, sin acoplar los dos componentes.

const OPEN_HELP_PANEL = "auream:open-help-panel";

export function openHelpPanel(): void {
  window.dispatchEvent(new Event(OPEN_HELP_PANEL));
}

/** Escucha los pedidos de abrir el panel. Devuelve cómo dejar de escuchar. */
export function onOpenHelpPanel(listener: () => void): () => void {
  window.addEventListener(OPEN_HELP_PANEL, listener);
  return () => window.removeEventListener(OPEN_HELP_PANEL, listener);
}
