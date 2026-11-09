import { timerOf, type FlowRunResult, type FlowStep } from "../../../contracts/FlowTimerContracts";
import type { InboundEnvelope } from "../../../contracts/RuntimeContracts";
import type { DeliveryReport, FlowTurnTarget } from "./ports/MessagingPorts";

// ---------------------------------------------------------------------------
// Historial INTERNO de los turnos de los flujos (no es una pantalla: es para
// revisar nosotros cuando algo se traba). Por cada turno: qué lo inició, por
// qué bloques pasó, qué salió y qué falló, qué espera quedó programada y si
// algo reventó. Lo escribe `FlowTurn`; dónde se guarda lo decide el puerto
// (Neon por 14 días y una línea en el registro de Vercel).
// ---------------------------------------------------------------------------

export type FlowTurnOrigin = "message" | "timer" | "manual";

export interface FlowTurnRecord {
  readonly tenantId: string;
  readonly conversationId: string;
  readonly conversationKey: string;
  readonly flowKey: string;
  readonly origin: FlowTurnOrigin;
  /** El texto del mensaje (recortado), el despertador (`resume` / `timeout`) o `manual`. */
  readonly trigger: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly steps: ReadonlyArray<FlowStep>;
  /** Eventos del motor (p. ej. `delay_node_scheduled:…`, `timer_stale:…`, `notification_skipped:…`). */
  readonly events: ReadonlyArray<string>;
  /** Dónde quedó la sesión. */
  readonly session: { readonly nodeId: string; readonly status: string } | null;
  readonly sent: number;
  readonly failures: ReadonlyArray<string>;
  /** La espera que quedó programada, si hay. */
  readonly wakeUp: { readonly reason: string; readonly at: string } | null;
  /** Si el turno reventó, el motivo. */
  readonly error: string | null;
}

export interface TurnJournal {
  record(entry: FlowTurnRecord): Promise<void>;
}

export const NO_JOURNAL: TurnJournal = { record: async () => undefined };

const TRIGGER_MAX = 200;

function originOf(envelope: InboundEnvelope): { origin: FlowTurnOrigin; trigger: string } {
  const timer = timerOf(envelope);
  if (timer) return { origin: "timer", trigger: `${timer.reason}:${timer.nodeId}` };
  if (envelope.payload["manual"] === true) return { origin: "manual", trigger: "manual" };
  const text = envelope.payload["text"];
  return { origin: "message", trigger: typeof text === "string" ? text.slice(0, TRIGGER_MAX) : "" };
}

/** Arma el registro de un turno (terminado o reventado). */
export function turnRecord(
  target: FlowTurnTarget & { readonly conversationId: string },
  envelope: InboundEnvelope,
  times: { readonly startedAt: Date; readonly finishedAt: Date },
  outcome: { readonly result?: FlowRunResult; readonly report?: DeliveryReport; readonly wakeUpAt?: string; readonly error?: unknown }
): FlowTurnRecord {
  const { result, report, error } = outcome;
  return {
    tenantId: target.tenantId,
    conversationId: target.conversationId,
    conversationKey: target.conversationKey,
    flowKey: target.flowKey,
    ...originOf(envelope),
    startedAt: times.startedAt.toISOString(),
    finishedAt: times.finishedAt.toISOString(),
    steps: result?.steps ?? [],
    events: result?.domainEvents ?? [],
    session: result?.session ? { nodeId: result.session.currentNodeId, status: result.session.status } : null,
    sent: report?.sent ?? 0,
    failures: report?.failures ?? [],
    wakeUp: result?.wakeUp ? { reason: result.wakeUp.reason, at: outcome.wakeUpAt ?? result.wakeUp.at } : null,
    error: error === undefined ? null : (error instanceof Error ? error.message : String(error)).slice(0, 500)
  };
}
