import type { InboundEnvelope, NodeExecutionResult, SessionStatus } from "./RuntimeContracts";

// ---------------------------------------------------------------------------
// Despertadores (FASE C6)
//
// El motor no espera: cuando un bloque necesita continuar más tarde lo
// DECLARA (`FlowRunResult.wakeUp`) y quien lo ejecuta (la mensajería) lo
// programa en la cola de tareas. Al vencer, llega un envelope de despertador
// (`payload.timer`) con el bloque y la revisión de la sesión que lo pidieron:
// si la sesión ya avanzó, el despertador está vencido y no hace nada.
// ---------------------------------------------------------------------------

/**
 *   resume    seguir después de una espera (Programador, pausa larga de un Mensaje)
 *   timeout   venció el tiempo máximo de una espera (Esperar respuesta, Menú)
 */
export type FlowTimerReason = "resume" | "timeout";

export interface FlowTimerPayload {
  readonly reason: FlowTimerReason;
  /** Bloque que lo pidió. */
  readonly nodeId: string;
  /** Revisión de la sesión cuando se pidió: si cambió, ya no aplica. */
  readonly revision: number;
}

/** Cuánto pueden sumar las pausas de un mismo turno sin la cola (la función tiene tiempo limitado). */
export const INLINE_PAUSE_BUDGET_MS = 20_000;

/** Envelope de un despertador vencido. */
export function timerEnvelope(base: Omit<InboundEnvelope, "payload" | "messageId">, timer: FlowTimerPayload): InboundEnvelope {
  return { ...base, messageId: `timer:${timer.nodeId}:${timer.revision}`, payload: { timer } };
}

/** El despertador que trae un envelope, si es uno válido. */
export function timerOf(envelope: InboundEnvelope): FlowTimerPayload | null {
  const raw = envelope.payload["timer"];
  if (typeof raw !== "object" || raw === null) return null;
  const timer = raw as Record<string, unknown>;
  const reason = timer["reason"];
  return (reason === "resume" || reason === "timeout") && typeof timer["nodeId"] === "string" && typeof timer["revision"] === "number"
    ? { reason, nodeId: timer["nodeId"], revision: timer["revision"] }
    : null;
}

/** Dónde quedó la sesión tras un turno. */
export interface FlowSessionState {
  readonly id: string;
  readonly flowId: string;
  readonly currentNodeId: string;
  readonly status: SessionStatus;
  readonly revision: number;
}

/** Cuándo y por qué despertar la sesión (lo programa quien ejecuta el motor). */
export interface FlowWakeUp {
  readonly reason: FlowTimerReason;
  readonly at: string;
  readonly nodeId: string;
  readonly revision: number;
  /**
   * Solo en esperas RELATIVAS (Intervalo de X minutos, pausa de un Mensaje,
   * tiempo máximo de Esperar respuesta y del Menú): el instante en que el
   * motor calculó que empieza la espera (tras las pausas del turno). Quien
   * entrega corre `at` lo que la entrega real se pase de ahí
   * (`alignWakeUpToDelivery`). Las horas fijas (una fecha, el inicio de una
   * franja del horario) no lo llevan y no se mueven.
   */
  readonly from?: string;
}

/**
 * Una espera relativa cuenta desde que el cliente recibió el último mensaje,
 * no desde que el motor la planeó: si la entrega (envíos, red) terminó
 * después de `from`, el despertador se corre exactamente eso.
 */
export function alignWakeUpToDelivery(wakeUp: FlowWakeUp, deliveredAt: Date): FlowWakeUp {
  if (!wakeUp.from) return wakeUp;
  const overrun = deliveredAt.getTime() - Date.parse(wakeUp.from);
  if (!Number.isFinite(overrun) || overrun <= 0) return wakeUp;
  return { ...wakeUp, at: new Date(Date.parse(wakeUp.at) + overrun).toISOString() };
}

/** Resultado de un turno completo del motor. */
export interface FlowRunResult extends NodeExecutionResult {
  readonly session?: FlowSessionState;
  readonly wakeUp?: FlowWakeUp;
  /**
   * El turno no cambió la sesión (despertador vencido, mensaje durante un
   * Programador): los despertadores ya programados siguen valiendo.
   */
  readonly untouched?: boolean;
}

/** Clave de contexto donde la sesión recuerda cuándo debía despertar (se retoma si ya pasó). */
export const WAKE_CONTEXT_KEY = "__wake";
