import type { CanvasNode } from "../../types/canvas";

/** Lo que el laboratorio de pruebas ilumina en el lienzo. */
export interface LabTrail {
  /** Bloques por los que pasó el último turno de la prueba. */
  readonly visited: ReadonlySet<string>;
  /** Bloque donde la prueba está esperando (respuesta o temporizador). */
  readonly current: string | null;
}

/**
 * Los bloques con la clase de la prueba (`is-lab-visited`, `is-lab-current`)
 * en el contenedor de React Flow. Sin prueba, los mismos objetos (React Flow
 * no vuelve a pintar nada).
 */
export function withLabTrail(nodes: CanvasNode[], trail: LabTrail | undefined): CanvasNode[] {
  if (!trail || (trail.visited.size === 0 && !trail.current)) return nodes;
  return nodes.map((node) => {
    const classes = [trail.visited.has(node.id) ? "is-lab-visited" : "", node.id === trail.current ? "is-lab-current" : ""].filter(Boolean).join(" ");
    return classes ? { ...node, className: classes } : node;
  });
}
