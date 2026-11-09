import type { FlowTurnRecord, TurnJournal } from "../../../domains/messaging/application/FlowTurnJournal";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// Historial interno de los turnos en Neon (`023_flow_turn_log.sql`). Una fila
// por turno; cada tanto borra lo de más de 14 días.
// ---------------------------------------------------------------------------

export const FLOW_TURN_RETENTION_MS = 14 * 86_400_000;
/** Cada cuántos turnos anotados se barren los viejos (por instancia). */
const SWEEP_EVERY = 200;

export class SqlFlowTurnJournal implements TurnJournal {
  private written = 0;

  public constructor(
    private readonly sql: SqlClient,
    private readonly now: () => number = () => Date.now()
  ) {}

  public async record(entry: FlowTurnRecord): Promise<void> {
    await this.sql.query(
      `insert into flow_turn_log (tenant_id, conversation_id, conversation_key, flow_key, origin, trigger, started_at, finished_at,
                                  steps, events, session_node, session_status, sent, failures, wake_up, error)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14::jsonb, $15::jsonb, $16)`,
      [
        entry.tenantId, entry.conversationId, entry.conversationKey, entry.flowKey, entry.origin, entry.trigger, entry.startedAt, entry.finishedAt,
        JSON.stringify(entry.steps), JSON.stringify(entry.events), entry.session?.nodeId ?? null, entry.session?.status ?? null,
        entry.sent, JSON.stringify(entry.failures), entry.wakeUp ? JSON.stringify(entry.wakeUp) : null, entry.error
      ]
    );
    this.written += 1;
    if (this.written % SWEEP_EVERY === 0) {
      await this.sql.query("delete from flow_turn_log where started_at < $1", [new Date(this.now() - FLOW_TURN_RETENTION_MS).toISOString()]).catch(() => undefined);
    }
  }
}
