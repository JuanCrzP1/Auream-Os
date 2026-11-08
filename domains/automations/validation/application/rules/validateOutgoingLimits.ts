import type { FlowSnapshot } from "../../../../../contracts/FlowSnapshot";
import { ENTRY_MAX_OUTGOING, SINGLE_OUTPUT_NODE_TYPES } from "../../../../../contracts/FlowConnectionRules";
import type { ValidationIssue } from "../ValidationReport";

/**
 * De cada salida sale como mucho una conexión. En el snapshot de ejecución no
 * viaja la salida de origen, así que aquí se comprueba lo que sí se puede: los
 * bloques de salida única y el de entrada. La regla por salida con nombre la
 * aplica el builder (`connectionRules`) al conectar y al validar el lienzo.
 */
export function validateOutgoingLimits(snapshot: FlowSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entryNodeId = snapshot.version.entryNodeId;

  for (const [nodeId, node] of Object.entries(snapshot.nodes)) {
    const outgoing = (snapshot.edgesBySource[nodeId] ?? []).length;

    if (nodeId === entryNodeId && outgoing > ENTRY_MAX_OUTGOING) {
      issues.push({
        code: "ENTRY_TOO_MANY_OUTGOING",
        message: `El bloque de entrada '${nodeId}' tiene ${outgoing} conexiones de salida; solo puede tener una.`,
        nodeId
      });
      continue;
    }

    if (SINGLE_OUTPUT_NODE_TYPES.has(node.type) && outgoing > 1) {
      issues.push({
        code: "NODE_TOO_MANY_OUTGOING",
        message: `El nodo '${nodeId}' (tipo '${node.type}') tiene ${outgoing} conexiones de salida; su única salida admite una.`,
        nodeId
      });
    }
  }

  return issues;
}
