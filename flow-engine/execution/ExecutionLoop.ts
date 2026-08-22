import type { FlowSnapshot } from "../../contracts/FlowSnapshot";
import type { InboundEnvelope, NodeExecutionResult, RuntimeInput } from "../../contracts/RuntimeContracts";
import type { Session } from "../../contracts/RuntimeContracts";

import type { SessionStore, ContextWriter } from "../ports/RuntimePorts";
import { NodeRuntime } from "../nodes/NodeRuntime";
import { EdgeEvaluator } from "../edges/EdgeEvaluator";
import { ExecutionEventTracker } from "./ExecutionEventTracker";

// ---------------------------------------------------------------------------
// ExecutionLoop
//
// Responsabilidad única: ejecutar el ciclo hop-a-hop de un flow dado un
// snapshot, una sesión inicial y el envelope del mensaje entrante.
//
// El orquestador (ExecutionOrchestrator) resuelve el contexto de tenant,
// snapshot y sesión — luego delega la ejecución aquí.
//
// Diseño inmutable: `session` es una variable local que se REASIGNA en cada
// transición. Nunca se muta el objeto original.
// ---------------------------------------------------------------------------

export class ExecutionLoop {
  public constructor(
    private readonly sessionService: SessionStore,
    private readonly contextService: ContextWriter,
    private readonly nodeRuntime: NodeRuntime,
    private readonly edgeEvaluator: EdgeEvaluator,
    private readonly eventTracker: ExecutionEventTracker
  ) {}

  public run(
    snapshot: FlowSnapshot,
    initialSession: Session,
    envelope: InboundEnvelope
  ): NodeExecutionResult {
    let session = initialSession;

    const aggregate = {
      executionStatus: "success" as NodeExecutionResult["executionStatus"],
      outputMessages: [] as Array<NodeExecutionResult["outputMessages"][number]>,
      contextPatch: {} as Record<string, unknown>,
      nodeResult: {} as Record<string, unknown>,
      domainEvents: [] as string[]
    };

    for (let hop = 0; hop < 32; hop += 1) {
      const currentNode = snapshot.nodes[session.currentNodeId];

      if (!currentNode) {
        throw new Error(`Nodo actual inexistente: ${session.currentNodeId}`);
      }

      const runtimeInput: RuntimeInput = {
        envelope,
        sessionContext: session.context,
        isWaitingInput: session.status === "waiting_input"
      };

      const execution = this.nodeRuntime.execute(currentNode, runtimeInput, session);

      session = this.contextService.applyPatch(session, execution.contextPatch);

      aggregate.outputMessages.push(...execution.outputMessages);
      aggregate.contextPatch = { ...aggregate.contextPatch, ...execution.contextPatch };
      aggregate.nodeResult = { ...aggregate.nodeResult, ...execution.nodeResult };
      aggregate.domainEvents.push(...execution.domainEvents);

      this.eventTracker.trackNodeExecuted(session, currentNode.id, execution.executionStatus);

      if (execution.executionStatus === "waiting_input") {
        session = this.sessionService.updateStatus(session, "waiting_input");
        aggregate.executionStatus = "waiting_input";
        return aggregate;
      }

      if (execution.executionStatus === "delayed") {
        session = this.sessionService.updateStatus(session, "delayed");
        aggregate.executionStatus = "delayed";
        return aggregate;
      }

      if (execution.executionStatus === "failed") {
        session = this.sessionService.updateStatus(session, "failed");
        aggregate.executionStatus = "failed";
        return aggregate;
      }

      if (execution.executionStatus === "completed") {
        session = this.sessionService.updateStatus(session, "completed");
        aggregate.executionStatus = "completed";
        return aggregate;
      }

      const outgoingEdges = snapshot.edgesBySource[currentNode.id] ?? [];

      if (outgoingEdges.length === 0) {
        session = this.sessionService.updateStatus(session, "completed");
        aggregate.executionStatus = "completed";
        return aggregate;
      }

      const selectedEdge = this.edgeEvaluator.select(outgoingEdges, session, execution);

      if (!selectedEdge) {
        session = this.sessionService.updateStatus(session, "failed");
        aggregate.executionStatus = "failed";
        aggregate.domainEvents.push(`edge_selection_failed:${currentNode.id}`);
        return aggregate;
      }

      this.eventTracker.trackEdgeSelected(session, selectedEdge);

      session = this.sessionService.moveToNode(session, selectedEdge.toNodeId, "active");
    }

    session = this.sessionService.updateStatus(session, "failed");
    return {
      executionStatus: "failed",
      outputMessages: aggregate.outputMessages,
      contextPatch: aggregate.contextPatch,
      nodeResult: aggregate.nodeResult,
      domainEvents: [...aggregate.domainEvents, "max_hops_exceeded"]
    };
  }
}
