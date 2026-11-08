import type { FlowSnapshot } from "../../../../../contracts/FlowSnapshot";
import { START_NODE_TYPE } from "../../../../../contracts/FlowEntry";
import type { ValidationIssue } from "../ValidationReport";

/**
 * El flujo arranca en UN bloque de inicio (`start`): la entrada es de ese
 * tipo, no hay otro `start` y ninguna conexión llega a él.
 *
 * Separada de `validateEntryNode` (¿existe la entrada?) porque esto decide si
 * el flujo es PUBLICABLE, no si está conectado: `isStructurallyConnected` usa
 * aquella y no esta. Si la entrada no existe, ya lo informa aquella.
 */
export function validateStartBlock(snapshot: FlowSnapshot): ValidationIssue[] {
  const entryNodeId = snapshot.version.entryNodeId;
  const entryNode = entryNodeId ? snapshot.nodes[entryNodeId] : undefined;
  const issues: ValidationIssue[] = [];

  if (entryNode && entryNode.type !== START_NODE_TYPE && entryNode.type !== "end") {
    issues.push({
      code: "ENTRY_NODE_NOT_START",
      message: `El flujo debe empezar en el bloque de inicio, no en '${entryNodeId}' (tipo '${entryNode.type}').`,
      nodeId: entryNodeId
    });
  }

  for (const [nodeId, node] of Object.entries(snapshot.nodes)) {
    if (node.type === START_NODE_TYPE && nodeId !== entryNodeId) {
      issues.push({
        code: "START_NODE_NOT_ENTRY",
        message: `Solo puede haber un bloque de inicio: '${nodeId}' sobra.`,
        nodeId
      });
    }
  }

  if (entryNode) {
    for (const edges of Object.values(snapshot.edgesBySource)) {
      for (const edge of edges) {
        if (edge.toNodeId === entryNodeId) {
          issues.push({
            code: "ENTRY_HAS_INCOMING",
            message: `Ninguna conexión puede llegar al bloque de inicio ('${edge.id}' lo hace).`,
            nodeId: entryNodeId
          });
        }
      }
    }
  }

  return issues;
}
