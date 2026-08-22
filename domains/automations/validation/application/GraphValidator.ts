import type { FlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { ValidationIssue, ValidationReport } from "./ValidationReport";
import { validateEmptyFlow } from "./rules/validateEmptyFlow";
import { validateEntryNode } from "./rules/validateEntryNode";
import { validateEdgeIntegrity } from "./rules/validateEdgeIntegrity";
import { validateEdgePriorities } from "./rules/validateEdgePriorities";
import { validateNodeDegree } from "./rules/validateNodeDegree";
import { validateFallbacks } from "./rules/validateFallbacks";
import { detectCycles } from "./rules/detectCycles";
import { detectUnreachable } from "./rules/detectUnreachable";

// Re-exportar los tipos para que los importadores existentes no rompan
export type { ValidationIssue, ValidationReport };

export class GraphValidator {
  public validate(snapshot: FlowSnapshot): ValidationReport {
    const nodeIds = new Set(Object.keys(snapshot.nodes));

    // Flujo vacío: parar aquí, el resto de reglas no aplican
    const emptyErrors = validateEmptyFlow(snapshot);
    if (emptyErrors.length > 0) {
      return { isValid: false, errors: emptyErrors, warnings: [] };
    }

    const entryNodeId = snapshot.version.entryNodeId;
    const entryIsReachable = Boolean(entryNodeId) && nodeIds.has(entryNodeId);

    const errors: ValidationIssue[] = [
      ...validateEntryNode(snapshot, nodeIds),
      ...validateEdgeIntegrity(snapshot, nodeIds),
      ...validateEdgePriorities(snapshot),
      ...validateNodeDegree(snapshot),
      ...validateFallbacks(snapshot),
      ...(entryIsReachable ? detectCycles(snapshot, entryNodeId, nodeIds) : [])
    ];

    const warnings: ValidationIssue[] = entryIsReachable
      ? detectUnreachable(snapshot, entryNodeId, nodeIds).map((nodeId): ValidationIssue => ({
          code: "UNREACHABLE_NODE",
          message: `El nodo '${nodeId}' no es alcanzable desde el entry node.`,
          nodeId
        }))
      : [];

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

