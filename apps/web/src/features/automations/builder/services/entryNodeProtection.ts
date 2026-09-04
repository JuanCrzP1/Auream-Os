import type { NodeChange } from "@xyflow/react";
import type { CanvasNode } from "../types/canvas";

// ---------------------------------------------------------------------------
// Protección del nodo de entrada.
//
// El nodo de entrada sostiene `version.entryNodeId`. Si desaparece del lienzo,
// ese puntero queda apuntando a un nodo inexistente: `mapCanvasToSnapshot`
// hereda la versión del snapshot base y NO lo recalcula, el autoguardado
// persiste el grafo roto, y el usuario no se entera hasta que
// `validateEntryNode` lo rechaza al publicar — con todo el trabajo posterior
// hecho encima de un flujo sin entrada.
//
// Ocultar el botón de borrar en la tarjeta NO es protección: React Flow emite
// un cambio `remove` con la tecla Suprimir sin pasar por la tarjeta. La
// protección tiene que vivir donde el borrado se aplica —el dueño del estado—
// y por eso estas funciones son puras y las consume `useCanvasNodes`.
//
// Mover NO es borrar: los cambios de posición del nodo de entrada pasan
// intactos. El usuario puede colocarlo donde quiera.
// ---------------------------------------------------------------------------

/** `true` si `nodeId` es el nodo de entrada del lienzo. */
export function isEntryNode(nodes: ReadonlyArray<CanvasNode>, nodeId: string): boolean {
  return nodes.some((node) => node.id === nodeId && node.data.isEntry);
}

/**
 * Descarta los cambios que borrarían el nodo de entrada.
 *
 * Solo filtra `remove`. Posición, selección y dimensiones siguen su camino,
 * incluidas las del propio nodo de entrada.
 */
export function rejectEntryNodeRemoval(
  changes: ReadonlyArray<NodeChange<CanvasNode>>,
  nodes: ReadonlyArray<CanvasNode>
): NodeChange<CanvasNode>[] {
  return changes.filter((change) => change.type !== "remove" || !isEntryNode(nodes, change.id));
}
