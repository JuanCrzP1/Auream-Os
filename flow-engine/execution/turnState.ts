import type { NodeExecutionResult, Session } from "../../contracts/RuntimeContracts";
import type { FlowSessionState, FlowWakeUp } from "../../contracts/FlowTimerContracts";

// Ayudantes del turno del motor (FASE C6): dónde quedó la sesión, cuándo
// despertarla y cuánto suman las pausas ya puestas. Puros.

/** Dónde quedó la sesión (lo que devuelve el turno). */
export const stateOf = (session: Session): FlowSessionState => ({
  id: session.id,
  flowId: session.flowId,
  currentNodeId: session.currentNodeId,
  status: session.status,
  revision: session.revision
});

/** Lo que el último bloque pidió: cuándo despertar la sesión. */
export function wakeUpOf(status: string, nodeResult: Readonly<Record<string, unknown>>, session: Session): FlowWakeUp | undefined {
  const at = status === "delayed" ? nodeResult["resumeAt"] : status === "waiting_input" ? nodeResult["waitDeadlineAt"] : undefined;
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return undefined;
  // Esperas relativas: desde cuándo cuentan según el plan (la entrega la corrige).
  const from = nodeResult["waitFrom"];
  return {
    reason: status === "delayed" ? "resume" : "timeout",
    at,
    nodeId: session.currentNodeId,
    revision: session.revision,
    ...(typeof from === "string" && !Number.isNaN(Date.parse(from)) ? { from } : {})
  };
}

/** Suma de las pausas ya puestas en el turno. */
export const pausedMs = (messages: ReadonlyArray<NodeExecutionResult["outputMessages"][number]>) =>
  messages.reduce((total, message) => total + (message.kind === "pause" ? (message.delayMs ?? 0) : 0), 0);
