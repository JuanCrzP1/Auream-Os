import type { BuilderFlowNode, BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// Dónde poner en el lienzo un bloque que crea un agente: a la derecha del
// bloque del que sale (cada salida un poco más abajo) y sin tapar otro. Así,
// al abrir el flujo en el editor, se lee de izquierda a derecha como si lo
// hubiera armado una persona.
// ---------------------------------------------------------------------------

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

const COLUMN_GAP = 340;
const ROW_GAP = 180;
/** Dos bloques más cerca que esto (en x e y) se tapan. */
const OVERLAP = { x: 240, y: 120 } as const;
const FALLBACK: CanvasPoint = { x: 200, y: 220 };

export function positionOf(node: BuilderFlowNode | undefined): CanvasPoint {
  const ui = node?.metadata["ui"] as { x?: unknown; y?: unknown } | undefined;
  return { x: typeof ui?.x === "number" ? ui.x : FALLBACK.x, y: typeof ui?.y === "number" ? ui.y : FALLBACK.y };
}

/** Posición libre para un bloque nuevo: después de `parent` (en la fila de su salida `slot`) o a la derecha de todo. */
export function placeNewBlock(draft: BuilderFlowSnapshot, parentId: string | null, slot: number): CanvasPoint {
  const occupied = Object.values(draft.nodes).map(positionOf);
  const parent = parentId ? draft.nodes[parentId] : undefined;
  const desired = parent
    ? { x: positionOf(parent).x + COLUMN_GAP, y: positionOf(parent).y + Math.max(0, slot) * ROW_GAP }
    : { x: Math.max(FALLBACK.x, ...occupied.map((point) => point.x)) + COLUMN_GAP, y: positionOf(draft.nodes[draft.version.entryNodeId]).y };

  const taken = (point: CanvasPoint) => occupied.some((other) => Math.abs(other.x - point.x) < OVERLAP.x && Math.abs(other.y - point.y) < OVERLAP.y);
  let point = desired;
  for (let step = 1; taken(point) && step < 50; step += 1) point = { x: desired.x, y: desired.y + step * ROW_GAP };
  return point;
}
