import type { FlowTurnRecord, TurnJournal } from "../../../domains/messaging/application/FlowTurnJournal";
import type { StructuredLogger } from "../../../platform/observability/logging/StructuredLogger";

// ---------------------------------------------------------------------------
// El historial interno de los turnos, en dos lugares:
//
//   Neon        la fila completa, 14 días (`SqlFlowTurnJournal`)
//   registro    una línea `flow.turn` resumida (sin el texto del cliente):
//               en una prueba se ve al momento, sin leer la base
//
// Si guardar en Neon falla, queda la línea del registro y un aviso.
// ---------------------------------------------------------------------------

export function summarizeTurn(entry: FlowTurnRecord): Record<string, unknown> {
  return {
    tenantId: entry.tenantId,
    conversation: entry.conversationKey.slice(-4),
    flow: entry.flowKey,
    origin: entry.origin,
    ...(entry.origin === "timer" ? { timer: entry.trigger } : {}),
    ms: Date.parse(entry.finishedAt) - Date.parse(entry.startedAt),
    steps: entry.steps.map((step) => `${step.type}:${step.status}${step.output ? `>${step.output}` : ""}`),
    session: entry.session ? `${entry.session.status}@${entry.session.nodeId}` : null,
    sent: entry.sent,
    ...(entry.failures.length > 0 ? { failures: entry.failures } : {}),
    ...(entry.wakeUp ? { wakeUp: entry.wakeUp } : {}),
    ...(entry.error ? { error: entry.error } : {})
  };
}

export function composeTurnJournal(store: TurnJournal, logger: Pick<StructuredLogger, "info" | "warn">): TurnJournal {
  return {
    async record(entry) {
      if (entry.error) logger.warn("flow.turn", summarizeTurn(entry));
      else logger.info("flow.turn", summarizeTurn(entry));
      await store.record(entry).catch((error: unknown) => logger.warn("flow.turn_log_failed", { error: error instanceof Error ? error.message : String(error) }));
    }
  };
}
