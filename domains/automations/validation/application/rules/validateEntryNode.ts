import type { FlowSnapshot, NodeType } from "../../../../../contracts/FlowSnapshot";
import type { ValidationIssue } from "../ValidationReport";

const TERMINAL_NODE_TYPES: ReadonlySet<NodeType> = new Set(["end"]);

/**
 * Verifica que el entryNodeId exista, apunte a un nodo real
 * y que ese nodo no sea de tipo terminal.
 */
export function validateEntryNode(snapshot: FlowSnapshot, nodeIds: ReadonlySet<string>): ValidationIssue[] {
  const entryNodeId = snapshot.version.entryNodeId;

  if (!entryNodeId) {
    return [{ code: "MISSING_ENTRY_NODE", message: "No hay entryNodeId definido en la versión." }];
  }

  if (!nodeIds.has(entryNodeId)) {
    return [{
      code: "INVALID_ENTRY_NODE",
      message: `El entryNodeId '${entryNodeId}' no existe en el mapa de nodos.`,
      nodeId: entryNodeId
    }];
  }

  const entryNode = snapshot.nodes[entryNodeId];
  if (TERMINAL_NODE_TYPES.has(entryNode.type)) {
    return [{
      code: "ENTRY_NODE_IS_TERMINAL",
      message: `El entryNode '${entryNodeId}' es de tipo terminal '${entryNode.type}'. No puede ser entry.`,
      nodeId: entryNodeId
    }];
  }

  return [];
}
