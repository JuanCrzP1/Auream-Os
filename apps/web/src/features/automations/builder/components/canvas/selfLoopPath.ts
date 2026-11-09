/**
 * Trazo de una conexión que vuelve a su propio bloque («Otra respuesta» del
 * Menú → el mismo Menú). Una curva normal iría de la salida (derecha) a la
 * entrada (izquierda) atravesando el bloque; este lazo sale por la derecha,
 * baja por debajo del bloque y vuelve a entrar por la izquierda, con las
 * esquinas redondeadas.
 *
 * Pura: recibe los puntos de los handles y el borde inferior del bloque, y
 * devuelve el trazado SVG y el punto medio (donde va el botón de eliminar).
 */

/** Cuánto sale el lazo hacia los lados de los handles. */
const REACH = 28;
/** Cuánto baja por debajo del bloque. */
const DROP = 36;
/** Radio de las esquinas. */
const RADIUS = 14;

export interface SelfLoopGeometry {
  readonly sourceX: number;
  readonly sourceY: number;
  readonly targetX: number;
  readonly targetY: number;
  /** Borde inferior del bloque (coordenadas del lienzo). */
  readonly bottom: number;
}

export function selfLoopPath({ sourceX, sourceY, targetX, targetY, bottom }: SelfLoopGeometry): { path: string; labelX: number; labelY: number } {
  const right = sourceX + REACH;
  const left = targetX - REACH;
  const below = Math.max(bottom, sourceY, targetY) + DROP;
  const path = [
    `M ${sourceX} ${sourceY}`,
    `L ${right - RADIUS} ${sourceY}`,
    `Q ${right} ${sourceY} ${right} ${sourceY + RADIUS}`,
    `L ${right} ${below - RADIUS}`,
    `Q ${right} ${below} ${right - RADIUS} ${below}`,
    `L ${left + RADIUS} ${below}`,
    `Q ${left} ${below} ${left} ${below - RADIUS}`,
    `L ${left} ${targetY + RADIUS}`,
    `Q ${left} ${targetY} ${left + RADIUS} ${targetY}`,
    `L ${targetX} ${targetY}`
  ].join(" ");
  return { path, labelX: (right + left) / 2, labelY: below };
}
