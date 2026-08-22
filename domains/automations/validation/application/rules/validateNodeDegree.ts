import type { FlowSnapshot, NodeType } from "../../../../../contracts/FlowSnapshot";
import type { ValidationIssue } from "../ValidationReport";

/**
 * Tipos de nodo que DEBEN tener al menos un edge saliente.
 * El nodo terminal (end) no está incluido porque por definición no tiene salida.
 */
const EXPECTED_OUTGOING_TYPES: ReadonlySet<NodeType> = new Set([
  "message", "question", "capture", "action", "condition", "delay", "fallback", "ai"
]);

/**
 * Verifica que los nodos no terminales tengan al menos un edge saliente.
 * Un nodo sin salida es un dead-end que detiene el flujo sin completarlo.
 */
export function validateNodeDegree(snapshot: FlowSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const [nodeId, node] of Object.entries(snapshot.nodes)) {
    if (!EXPECTED_OUTGOING_TYPES.has(node.type)) {
      continue;
    }

    const outgoing = snapshot.edgesBySource[nodeId] ?? [];
    if (outgoing.length === 0) {
      issues.push({
        code: "NODE_NO_OUTGOING_EDGES",
        message: `El nodo '${nodeId}' (tipo '${node.type}') no tiene edges salientes y no es terminal.`,
        nodeId
      });
    }
  }

  return issues;
}
