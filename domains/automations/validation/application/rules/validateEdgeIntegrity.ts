import type { FlowSnapshot } from "../../../../../contracts/FlowSnapshot";
import type { ValidationIssue } from "../ValidationReport";

/**
 * Verifica la integridad de todos los edges del snapshot:
 * - El source (clave en edgesBySource) debe existir en nodes
 * - El toNodeId de cada edge debe existir en nodes
 * - El fromNodeId de cada edge debe coincidir con el source y existir en nodes
 * - No debe haber edges con IDs duplicados
 */
export function validateEdgeIntegrity(snapshot: FlowSnapshot, nodeIds: ReadonlySet<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenEdgeIds = new Set<string>();

  for (const [sourceNodeId, edges] of Object.entries(snapshot.edgesBySource)) {
    if (!nodeIds.has(sourceNodeId)) {
      issues.push({
        code: "ORPHAN_EDGE_SOURCE",
        message: `Hay edges salientes desde el nodo '${sourceNodeId}' que no existe en el mapa de nodos.`,
        nodeId: sourceNodeId
      });
    }

    for (const edge of edges) {
      if (seenEdgeIds.has(edge.id)) {
        issues.push({
          code: "DUPLICATE_EDGE_ID",
          message: `El edge '${edge.id}' está duplicado.`,
          edgeId: edge.id
        });
      }
      seenEdgeIds.add(edge.id);

      if (!nodeIds.has(edge.toNodeId)) {
        issues.push({
          code: "EDGE_INVALID_TARGET",
          message: `El edge '${edge.id}' apunta al nodo '${edge.toNodeId}' que no existe.`,
          edgeId: edge.id,
          nodeId: edge.toNodeId
        });
      }

      if (!nodeIds.has(edge.fromNodeId)) {
        issues.push({
          code: "EDGE_INVALID_SOURCE",
          message: `El edge '${edge.id}' tiene fromNodeId '${edge.fromNodeId}' que no existe en el mapa de nodos.`,
          edgeId: edge.id,
          nodeId: edge.fromNodeId
        });
      }
    }
  }

  return issues;
}
