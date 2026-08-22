import type { FlowEdge } from "../../contracts/FlowSnapshot";
import type { ExecutionStatus } from "../../contracts/RuntimeContracts";
import type { Session } from "../../contracts/RuntimeContracts";
import type { AnalyticsSink } from "../ports/RuntimePorts";

export class ExecutionEventTracker {
  public constructor(private readonly analytics: AnalyticsSink) {}

  public trackNodeExecuted(session: Session, nodeId: string, status: ExecutionStatus): void {
    this.analytics.track("node_executed", {
      tenantId: session.tenantId,
      sessionId: session.id,
      nodeId,
      status
    });
  }

  public trackEdgeSelected(session: Session, edge: FlowEdge): void {
    this.analytics.track("edge_selected", {
      tenantId: session.tenantId,
      sessionId: session.id,
      edgeId: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId
    });
  }
}
