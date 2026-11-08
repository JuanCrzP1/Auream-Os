import type { FlowSnapshot, NodeType } from "../../../../../contracts/FlowSnapshot";
import type { ValidationIssue } from "../ValidationReport";

/**
 * Tipos de nodo que DEBEN tener al menos un edge saliente: solo el inicio.
 *
 * Cualquier otro bloque puede ser el último del flujo (un Mensaje de
 * despedida, unas Etiquetas…): al no tener salida, la ejecución termina ahí
 * limpiamente (`EdgeEvaluator` → `unconnected-output`). Un inicio sin salida,
 * en cambio, es un flujo que no hace nada.
 */
const EXPECTED_OUTGOING_TYPES: ReadonlySet<NodeType> = new Set(["start"]);

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
        message: `El nodo '${nodeId}' (tipo '${node.type}') no lleva a ningún bloque.`,
        nodeId
      });
    }
  }

  return issues;
}
