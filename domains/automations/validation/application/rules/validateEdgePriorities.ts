import type { FlowSnapshot } from "../../../../../contracts/FlowSnapshot";
import type { ValidationIssue } from "../ValidationReport";

/**
 * Detecta prioridades duplicadas en los edges salientes de un mismo nodo.
 * Las prioridades duplicadas son un ERROR porque el EdgeEvaluator
 * no tiene forma de desempatar de forma determinística.
 */
export function validateEdgePriorities(snapshot: FlowSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [sourceNodeId, edges] of Object.entries(snapshot.edgesBySource)) {
    const seenPriorities = new Set<number>();

    for (const edge of edges) {
      if (seenPriorities.has(edge.priority)) {
        issues.push({
          code: "DUPLICATE_EDGE_PRIORITY",
          message: `El nodo '${sourceNodeId}' tiene múltiples edges con priority ${edge.priority}.`,
          nodeId: sourceNodeId,
          edgeId: edge.id
        });
      }
      seenPriorities.add(edge.priority);
    }
  }

  return issues;
}
