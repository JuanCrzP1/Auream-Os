import type { FlowSnapshot } from "../../../../../contracts/FlowSnapshot";
import type { ValidationIssue } from "../ValidationReport";

export function validateEmptyFlow(snapshot: FlowSnapshot): ValidationIssue[] {
  if (Object.keys(snapshot.nodes).length === 0) {
    return [{ code: "EMPTY_FLOW", message: "El flujo no contiene nodos." }];
  }
  return [];
}
