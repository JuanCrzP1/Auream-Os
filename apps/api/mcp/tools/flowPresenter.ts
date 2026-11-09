import type { BuilderFlowNode, BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import { blockOutputs } from "../../../../contracts/blocks/blockCatalog";
import type { FlowReview } from "../../../../contracts/blocks/reviewFlow";
import type { FlowEdited } from "../../../../domains/automations/editing/application/FlowEditingService";

// ---------------------------------------------------------------------------
// Cómo ve un agente un flujo: cada bloque con su configuración y, por cada
// salida, a qué bloque lleva; y la revisión del flujo (lo mismo que ve el
// usuario en el editor). Sin posiciones del lienzo ni datos internos.
// ---------------------------------------------------------------------------

export interface PresentedOutput {
  readonly output: string | null;
  readonly label: string;
  readonly connectedTo: string | null;
}

export function presentBlock(draft: BuilderFlowSnapshot, node: BuilderFlowNode) {
  const edges = draft.edgesBySource[node.id] ?? [];
  const isEntry = node.id === draft.version.entryNodeId;
  const named = isEntry ? null : blockOutputs(node.type, node.config);
  const outputs: PresentedOutput[] = named
    ? named.map((output) => ({ output: output.id, label: output.label, connectedTo: edges.find((edge) => edge.fromOutput === output.id)?.toNodeId ?? null }))
    : [{ output: null, label: "Siguiente", connectedTo: edges.find((edge) => !edge.fromOutput)?.toNodeId ?? null }];
  return { id: node.id, type: node.type, name: node.name, ...(isEntry ? { entry: true } : {}), config: node.config, outputs };
}

export function presentReview(review: FlowReview) {
  return {
    errors: review.errorCount,
    warnings: review.warningCount,
    issues: review.issues.map((issue) => ({ severity: issue.severity, message: issue.message, ...(issue.nodeId ? { blockId: issue.nodeId } : {}) }))
  };
}

export function presentFlow(edited: FlowEdited<object>) {
  return {
    ...edited.flow,
    entryBlockId: edited.draft.version.entryNodeId,
    blocks: Object.values(edited.draft.nodes).map((node) => presentBlock(edited.draft, node)),
    review: presentReview(edited.review)
  };
}

/** Respuesta de un cambio: el flujo, lo que cambió, el bloque tocado (si hay) y la revisión. */
export function presentChange(edited: FlowEdited<object>, blockId: string | null, extra: Readonly<Record<string, unknown>> = {}) {
  const node = blockId ? edited.draft.nodes[blockId] : undefined;
  const detail = Object.fromEntries(Object.entries({ ...edited.detail, ...extra }).filter(([, value]) => value !== null && !(Array.isArray(value) && value.length === 0)));
  return {
    flow: { id: edited.flow.id, name: edited.flow.name, blocks: Object.keys(edited.draft.nodes).length },
    ...detail,
    ...(node ? { block: presentBlock(edited.draft, node) } : {}),
    review: presentReview(edited.review)
  };
}
