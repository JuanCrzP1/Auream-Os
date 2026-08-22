import type { FlowEdge } from "../../contracts/FlowSnapshot";
import type { NodeExecutionResult } from "../../contracts/RuntimeContracts";
import type { Session } from "../../contracts/RuntimeContracts";

export class EdgeEvaluator {
  public select(edges: ReadonlyArray<FlowEdge>, session: Session, execution: NodeExecutionResult): FlowEdge | null {
    const ordered = [...edges].sort((left, right) => left.priority - right.priority);
    const fallback = ordered.find((edge) => edge.isFallback) ?? null;

    for (const edge of ordered) {
      if (edge.isFallback) {
        continue;
      }

      if (this.matches(edge, session, execution)) {
        return edge;
      }
    }

    return fallback;
  }

  private matches(edge: FlowEdge, session: Session, execution: NodeExecutionResult): boolean {
    const condition = edge.condition;

    if (condition.operator === "always") {
      return true;
    }

    if (!condition.fact) {
      return false;
    }

    const source = condition.fact.startsWith("node_result.")
      ? execution.nodeResult[condition.fact.replace("node_result.", "")]
      : session.context[condition.fact.replace("context.", "")];

    if (condition.operator === "exists") {
      return source !== undefined && source !== null && source !== "";
    }

    if (condition.operator === "eq") {
      return source === condition.value;
    }

    if (condition.operator === "neq") {
      return source !== condition.value;
    }

    return false;
  }
}