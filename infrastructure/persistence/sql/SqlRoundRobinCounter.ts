import type { RoundRobinCounter } from "../../../flow-engine/ports/RoundRobinCounter";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlRoundRobinCounter — turnos del Distribuidor en PostgreSQL.
//
// Una sola sentencia lee y avanza (`automation_counters`): la fila se bloquea
// durante el `update`, así que dos ejecuciones simultáneas obtienen turnos
// distintos y consecutivos.
// ---------------------------------------------------------------------------

export class SqlRoundRobinCounter implements RoundRobinCounter {
  public constructor(private readonly sql: SqlExecutor) {}

  public async next(tenantId: string, key: string): Promise<number> {
    const result = await this.sql.query<{ turn: string }>(
      `insert into automation_counters (tenant_id, counter_key, value)
       values ($1, $2, 1)
       on conflict (tenant_id, counter_key) do update set
         value = automation_counters.value + 1,
         updated_at = now()
       returning value - 1 as turn`,
      [tenantId, key]
    );
    return Number(result.rows[0]!.turn);
  }
}
