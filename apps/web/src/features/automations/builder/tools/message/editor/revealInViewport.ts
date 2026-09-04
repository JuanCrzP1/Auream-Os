// ---------------------------------------------------------------------------
// Llevar un bloque a la vista dentro del constructor.
//
// Actúa sobre un contenedor EXPLÍCITO. No usa `scrollIntoView`, que sube por el
// árbol y desplaza todos los ancestros desplazables que encuentre: con eso, el
// marco del nodo se movía entero y la biblioteca y la zona de continuación se
// salían de la ventana.
//
// Dos comportamientos, según dónde esté el bloque:
//
//   - Al FINAL: se va al fondo. Es lo único que garantiza que el bloque nuevo y
//     la zona de continuación queden visibles A LA VEZ; llevar solo el bloque
//     dejaría la zona justo debajo del borde y el usuario no vería dónde
//     seguir.
//   - En MEDIO: se desplaza lo mínimo. Si ya se ve, no se mueve nada — saltar
//     cuando no hace falta es tan molesto como no saltar cuando hace falta.
// ---------------------------------------------------------------------------

/** Aire entre el bloque y el borde del área, para que no quede pegado. */
const MARGEN = 12;

function desplazar(viewport: HTMLElement, top: number, suave: boolean): void {
  const destino = Math.max(0, top);

  // `scrollTo` con opciones no existe en todos los entornos —jsdom entre
  // ellos—, así que la posición se fija siempre y la animación es un extra.
  if (suave && typeof viewport.scrollTo === "function") {
    viewport.scrollTo({ top: destino, behavior: "smooth" });
    return;
  }

  viewport.scrollTop = destino;
}

/**
 * Deja visible el bloque indicado dentro del área desplazable del constructor.
 *
 * @param viewport Elemento con `overflow-y: auto`. El único que se desplaza.
 * @param bloque   Fila del bloque que hay que revelar.
 * @param alFinal  El bloque es el último de la secuencia.
 */
export function revealInViewport(
  viewport: HTMLElement,
  bloque: HTMLElement,
  alFinal: boolean,
  suave = true
): void {
  if (alFinal) {
    desplazar(viewport, viewport.scrollHeight, suave);
    return;
  }

  const arriba = bloque.offsetTop;
  const abajo = arriba + bloque.offsetHeight;
  const visibleDesde = viewport.scrollTop;
  const visibleHasta = visibleDesde + viewport.clientHeight;

  if (arriba < visibleDesde) {
    desplazar(viewport, arriba - MARGEN, suave);
    return;
  }

  if (abajo > visibleHasta) {
    desplazar(viewport, abajo - viewport.clientHeight + MARGEN, suave);
  }
}
