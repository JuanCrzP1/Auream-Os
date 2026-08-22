import type { FlowSnapshot } from "../../../../../contracts/FlowSnapshot";

/**
 * BFS desde el entry node para detectar nodos inalcanzables.
 * Devuelve los IDs de los nodos que no pueden ser alcanzados
 * siguiendo ningún camino desde el entry.
 *
 * Los nodos inalcanzables son WARNINGS (no errores): el flujo puede
 * funcionar correctamente sin ellos, pero probablemente son residuo
 * de ediciones parciales o están mal conectados.
 */
export function detectUnreachable(
  snapshot: FlowSnapshot,
  entryNodeId: string,
  allNodeIds: ReadonlySet<string>
): string[] {
  const reached = new Set<string>();
  const queue: string[] = [entryNodeId];
  reached.add(entryNodeId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const outgoing = snapshot.edgesBySource[current] ?? [];

    for (const edge of outgoing) {
      if (!reached.has(edge.toNodeId) && allNodeIds.has(edge.toNodeId)) {
        reached.add(edge.toNodeId);
        queue.push(edge.toNodeId);
      }
    }
  }

  return [...allNodeIds].filter((id) => !reached.has(id));
}
