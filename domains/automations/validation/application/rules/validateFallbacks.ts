import type { FlowSnapshot } from "../../../../../contracts/FlowSnapshot";
import type { ValidationIssue } from "../ValidationReport";

/**
 * Los nodos de tipo 'question' deben tener al menos un edge con isFallback=true.
 * Sin fallback, si el usuario envía una respuesta inesperada el EdgeEvaluator
 * no puede seleccionar ningún edge y el flujo falla.
 */
export function validateFallbacks(snapshot: FlowSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [nodeId, node] of Object.entries(snapshot.nodes)) {
    if (node.type !== "question") {
      continue;
    }

    const outgoing = snapshot.edgesBySource[nodeId] ?? [];
    const hasFallback = outgoing.some((edge) => edge.isFallback);

    if (!hasFallback) {
      issues.push({
        code: "QUESTION_NO_FALLBACK",
        message: `El nodo question '${nodeId}' no tiene un edge de fallback definido.`,
        nodeId
      });
    }
  }

  return issues;
}
