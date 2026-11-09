import type { FlowSnapshot } from "../../contracts/FlowSnapshot";
import type { InboundEnvelope, NodeExecutionResult, RuntimeInput, Session } from "../../contracts/RuntimeContracts";
import { WAKE_CONTEXT_KEY, timerOf, type FlowRunResult } from "../../contracts/FlowTimerContracts";
import { pausedMs, stateOf, wakeUpOf } from "./turnState";

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
//
// DESPERTADORES (FASE C6). El motor no espera: un bloque que debe seguir más
// tarde lo declara (`resumeAt` de Programador o de una pausa larga del
// Mensaje, `waitDeadlineAt` de Esperar respuesta y Menú) y el turno devuelve
// `wakeUp` para que quien lo ejecuta lo programe. Al vencer llega un envelope
// con `payload.timer`:
//
//   · vale solo si la sesión sigue EXACTAMENTE donde lo pidió (mismo bloque y
//     misma revisión); si avanzó, es un despertador vencido y no toca nada.
//   · el bloque lo recibe en `input.timer` y decide (seguir, «Tiempo agotado»).
//
// Mientras la sesión está `delayed`, un mensaje del cliente no la mueve: el
// Programador sigue esperando su hora (no se reinicia ni se duplica). La
// sesión recuerda esa hora (`WAKE_CONTEXT_KEY`): si un mensaje llega cuando ya
// pasó (el despertador no corrió, p. ej. con el bot pausado), el flujo sigue
// ahí mismo. Nada se queda atascado si se pierde un despertador.
// ---------------------------------------------------------------------------

/** Zona por defecto si quien ejecuta no indica la del negocio. */
export const DEFAULT_TIMEZONE = "UTC";

export class ExecutionLoop {
  public constructor(
    private readonly sessionService: SessionStore,
    private readonly contextService: ContextWriter,
    private readonly nodeRuntime: NodeRuntime,
    private readonly edgeEvaluator: EdgeEvaluator,
    private readonly eventTracker: ExecutionEventTracker,
    /** Reloj inyectable: las pruebas fijan el momento de la ejecución. */
    private readonly clock: () => Date = () => new Date()
  ) {}

  /** Máximo de bloques por mensaje: corta un ciclo sin espera (protección). */
  private static readonly MAX_HOPS = 32;

  public async run(
    snapshot: FlowSnapshot,
    initialSession: Session,
    envelope: InboundEnvelope,
    options: { readonly timezone?: string } = {}
  ): Promise<FlowRunResult> {
    let session = initialSession;
    const now = this.clock().toISOString();
    const timezone = options.timezone ?? DEFAULT_TIMEZONE;
    const timer = timerOf(envelope);
    const untouched = (event: string): FlowRunResult => ({
      executionStatus: session.status === "active" ? "success" : session.status === "paused" ? "waiting_input" : session.status,
      outputMessages: [],
      contextPatch: {},
      nodeResult: {},
      domainEvents: [event],
      session: stateOf(session),
      untouched: true
    });
    // ¿Ya pasó la hora de despertar? Sin hora conocida para este bloque (una
    // sesión de una versión anterior, o un despertador perdido) también: nunca
    // se queda atascada esperando algo que nadie va a disparar.
    const overdueWake = (): boolean => {
      const wake = session.context[WAKE_CONTEXT_KEY] as { nodeId?: unknown; at?: unknown } | undefined;
      if (wake?.nodeId !== session.currentNodeId || typeof wake.at !== "string") return true;
      return Date.parse(wake.at) <= Date.parse(now);
    };
    // Un mensaje con el Programador ya vencido lo retoma, igual que su despertador.
    const resumeOverdue = !timer && session.status === "delayed" && overdueWake();

    if (timer) {
      const expected = timer.reason === "resume" ? "delayed" : "waiting_input";
      if (timer.nodeId !== session.currentNodeId || timer.revision !== session.revision || session.status !== expected) {
        return untouched(`timer_stale:${timer.nodeId}:${timer.revision}`);
      }
    } else if (session.status === "delayed" && !resumeOverdue) {
      return untouched(`delayed_message_ignored:${session.currentNodeId}`);
    }

    const aggregate = {
      executionStatus: "success" as NodeExecutionResult["executionStatus"],
      outputMessages: [] as Array<NodeExecutionResult["outputMessages"][number]>,
      contextPatch: {} as Record<string, unknown>,
      nodeResult: {} as Record<string, unknown>,
      domainEvents: [] as string[]
    };

    const finish = async (status: "completed" | "failed" | "waiting_input" | "delayed", event?: string, lastResult?: Readonly<Record<string, unknown>>): Promise<FlowRunResult> => {
      const pending = lastResult ? wakeUpOf(status, lastResult, session) : undefined;
      if (pending) session = this.contextService.applyPatch(session, { [WAKE_CONTEXT_KEY]: { reason: pending.reason, at: pending.at, nodeId: pending.nodeId } });
      session = await this.sessionService.updateStatus(session, status);
      aggregate.executionStatus = status;
      if (event) aggregate.domainEvents.push(event);
      // La revisión del despertador es la que quedó guardada.
      const wakeUp = pending ? { ...pending, revision: session.revision } : undefined;
      return { ...aggregate, session: stateOf(session), ...(wakeUp ? { wakeUp } : {}) };
    };

    for (let hop = 0; hop < ExecutionLoop.MAX_HOPS; hop += 1) {
      const currentNode = snapshot.nodes[session.currentNodeId];

      if (!currentNode) {
        throw new Error(`Nodo actual inexistente: ${session.currentNodeId}`);
      }

      const runtimeInput: RuntimeInput = {
        envelope,
        sessionContext: session.context,
        isWaitingInput: session.status === "waiting_input",
        now,
        timezone,
        // El despertador es solo para el bloque que lo pidió (el primero del turno).
        ...(hop === 0 && (timer || resumeOverdue) ? { timer: timer ? timer.reason : ("resume" as const) } : {}),
        inlinePauseUsedMs: pausedMs(aggregate.outputMessages)
      };

      const execution = await this.nodeRuntime.execute(currentNode, runtimeInput, session);

      session = this.contextService.applyPatch(session, execution.contextPatch);

      aggregate.outputMessages.push(...execution.outputMessages);
      aggregate.contextPatch = { ...aggregate.contextPatch, ...execution.contextPatch };
      aggregate.nodeResult = { ...aggregate.nodeResult, ...execution.nodeResult };
      aggregate.domainEvents.push(...execution.domainEvents);

      this.eventTracker.trackNodeExecuted(session, currentNode.id, execution.executionStatus);

      if (execution.executionStatus !== "success") {
        return finish(execution.executionStatus, undefined, execution.nodeResult);
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
      domainEvents: [...aggregate.domainEvents, "max_hops_exceeded"],
      session: stateOf(session)
    };
  }
}
