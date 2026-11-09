// ---------------------------------------------------------------------------
// Dónde poner un bloque nuevo sin taparlo con otro. Pura.
//
// Al añadir con un toque, el bloque va al centro de la vista. Si ahí ya hay
// uno (añadir varios seguidos), se corre en escalera hacia abajo a la derecha,
// como las ventanas en cascada: todos quedan a la vista y se pueden tomar.
// Cada `CASCADE_LENGTH` escalones empieza otra escalera a la derecha, para no
// salirse de la pantalla.
// ---------------------------------------------------------------------------

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

/** Desplazamiento de cada escalón: deja visible la cabecera del anterior. */
export const CASCADE_STEP: CanvasPoint = { x: 40, y: 56 };
export const CASCADE_LENGTH = 6;
/** Separación entre escaleras: algo más que el ancho de una tarjeta. */
export const CASCADE_COLUMN_GAP = 340;
/** Dos bloques más cerca que esto en ambos ejes se consideran encimados. */
const OVERLAP_TOLERANCE = 24;
const MAX_COLUMNS = 6;

export function freeCanvasPosition(desired: CanvasPoint, occupied: ReadonlyArray<CanvasPoint>): CanvasPoint {
  const isFree = (point: CanvasPoint) =>
    !occupied.some((other) => Math.abs(other.x - point.x) < OVERLAP_TOLERANCE && Math.abs(other.y - point.y) < OVERLAP_TOLERANCE);

  for (let column = 0; column < MAX_COLUMNS; column++) {
    for (let step = 0; step < CASCADE_LENGTH; step++) {
      const point = {
        x: desired.x + column * CASCADE_COLUMN_GAP + step * CASCADE_STEP.x,
        y: desired.y + step * CASCADE_STEP.y
      };
      if (isFree(point)) return point;
    }
  }
  return desired;
}
