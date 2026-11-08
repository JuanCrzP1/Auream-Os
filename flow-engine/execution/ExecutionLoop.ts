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

  /** Máximo de bloques por mensaje: corta un ciclo sin espera (protección). */
  private static readonly MAX_HOPS = 32;

  public async run(
    snapshot: FlowSnapshot,
    initialSession: Session,
    envelope: InboundEnvelope
  ): Promise<NodeExecutionResult> {
    let session = initialSession;

    const aggregate = {
      executionStatus: "success" as NodeExecutionResult["executionStatus"],
      outputMessages: [] as Array<NodeExecutionResult["outputMessages"][number]>,
      contextPatch: {} as Record<string, unknown>,
      nodeResult: {} as Record<string, unknown>,
      domainEvents: [] as string[]
    };

    const finish = async (status: "completed" | "failed" | "waiting_input" | "delayed", event?: string) => {
      session = await this.sessionService.updateStatus(session, status);
      aggregate.executionStatus = status;
      if (event) aggregate.domainEvents.push(event);
      return aggregate;
    };

    for (let hop = 0; hop < ExecutionLoop.MAX_HOPS; hop += 1) {
      const currentNode = snapshot.nodes[session.currentNodeId];

      if (!currentNode) {
        throw new Error(`Nodo actual inexistente: ${session.currentNodeId}`);
      }

      const runtimeInput: RuntimeInput = {
        envelope,
        sessionContext: session.context,
        isWaitingInput: session.status === "waiting_input"
      };

      const execution = await this.nodeRuntime.execute(currentNode, runtimeInput, session);

      session = this.contextService.applyPatch(session, execution.contextPatch);

      aggregate.outputMessages.push(...execution.outputMessages);
      aggregate.contextPatch = { ...aggregate.contextPatch, ...execution.contextPatch };
      aggregate.nodeResult = { ...aggregate.nodeResult, ...execution.nodeResult };
      aggregate.domainEvents.push(...execution.domainEvents);

      this.eventTracker.trackNodeExecuted(session, currentNode.id, execution.executionStatus);

      if (execution.executionStatus !== "success") {
        return finish(execution.executionStatus);
      }

      const outgoingEdges = snapshot.edgesBySource[currentNode.id] ?? [];

      if (outgoingEdges.length === 0) {
        return finish("completed");
      }

      const selection = this.edgeEvaluator.select(outgoingEdges, session, execution);

      // Salida sin conectar: el usuario decidió que la rama acaba ahí (C14).
      if (selection.kind === "unconnected-output") {
        return finish("completed", `output_not_connected:${currentNode.id}:${selection.output}`);
      }

      if (selection.kind === "no-match") {
        return finish("failed", `edge_selection_failed:${currentNode.id}`);
      }

      this.eventTracker.trackEdgeSelected(session, selection.edge);

      session = await this.sessionService.moveToNode(session, selection.edge.toNodeId, "active");
    }

    session = await this.sessionService.updateStatus(session, "failed");
    return {
      executionStatus: "failed",
      outputMessages: aggregate.outputMessages,
      contextPatch: aggregate.contextPatch,
      nodeResult: aggregate.nodeResult,
      domainEvents: [...aggregate.domainEvents, "max_hops_exceeded"]
    };
  }
}
