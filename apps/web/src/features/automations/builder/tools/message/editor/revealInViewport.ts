// ---------------------------------------------------------------------------
// Llevar un bloque a la vista dentro del área desplazable del constructor.
//
// Sobre un contenedor explícito, no `scrollIntoView` (que desplaza todos los
// ancestros y movía el marco entero). Al final: ir al fondo, para que el bloque
// y la zona de continuación se vean juntos. En medio: lo mínimo, y nada si ya
// se ve.
// ---------------------------------------------------------------------------

const MARGIN = 12;

function scrollTo(viewport: HTMLElement, top: number, smooth: boolean): void {
  const target = Math.max(0, top);

  // `scrollTo` con opciones no existe en todos los entornos (jsdom).
  if (smooth && typeof viewport.scrollTo === "function") {
    viewport.scrollTo({ top: target, behavior: "smooth" });
    return;
  }

  viewport.scrollTop = target;
}

export function revealInViewport(
  viewport: HTMLElement,
  row: HTMLElement,
  isLast: boolean,
  smooth = true
): void {
  if (isLast) {
    scrollTo(viewport, viewport.scrollHeight, smooth);
    return;
  }

  const top = row.offsetTop;
  const bottom = top + row.offsetHeight;
  const visibleFrom = viewport.scrollTop;
  const visibleTo = visibleFrom + viewport.clientHeight;

  if (top < visibleFrom) {
    scrollTo(viewport, top - MARGIN, smooth);
    return;
  }

  if (bottom > visibleTo) {
    scrollTo(viewport, bottom - viewport.clientHeight + MARGIN, smooth);
  }
}
