import type { TaskRepository } from "../../../domains/scheduling/application/TaskRepository";
import { CHAIN_TASK_KIND, DEFAULT_MAX_ATTEMPTS, type NewTask, type ScheduledTask, type TaskStatus } from "../../../domains/scheduling/domain/ScheduledTask";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Cola de tareas en PostgreSQL (`019_scheduled_tasks.sql`).
//
// La reserva es UNA sentencia: elige las vencidas con `for update skip
// locked` (dos rondas a la vez se reparten las tareas, nunca la misma) y las
// marca `running` con una reserva que caduca. Las reservas caducadas (un
// proceso que murió) vuelven a ser elegibles.
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  tenant_id: string;
  kind: string;
  group_key: string;
  dedupe_key: string;
  payload: Record<string, unknown>;
  status: TaskStatus;
  due_at: Date | string;
  attempts: number;
  max_attempts: number;
  locked_until: Date | string | null;
  last_error: string | null;
  created_at: Date | string;
  finished_at: Date | string | null;
}

const COLUMNS = "id, tenant_id, kind, group_key, dedupe_key, payload, status, due_at, attempts, max_attempts, locked_until, last_error, created_at, finished_at";

const toTask = (row: Row): ScheduledTask => ({
  id: row.id,
  tenantId: row.tenant_id,
  kind: row.kind,
  groupKey: row.group_key,
  dedupeKey: row.dedupe_key,
  payload: row.payload ?? {},
  status: row.status,
  dueAt: toIso(row.due_at),
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
  lockedUntil: row.locked_until === null ? null : toIso(row.locked_until),
  lastError: row.last_error,
  createdAt: toIso(row.created_at),
  finishedAt: row.finished_at === null ? null : toIso(row.finished_at)
});

export class SqlTaskRepository implements TaskRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async enqueue(id: string, task: NewTask): Promise<boolean> {
    if (!isUuid(task.tenantId)) return false;
    const result = await this.sql.query<{ id: string }>(
      `insert into scheduled_tasks (id, tenant_id, kind, group_key, dedupe_key, payload, due_at, max_attempts)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (dedupe_key) do nothing
       returning id`,
      [id, task.tenantId, task.kind, task.groupKey, task.dedupeKey, JSON.stringify(task.payload), task.dueAt.toISOString(), task.maxAttempts ?? DEFAULT_MAX_ATTEMPTS]
    );
    return result.rows.length > 0;
  }

  public async cancelGroup(tenantId: string, groupKey: string, except?: string): Promise<number> {
    if (!isUuid(tenantId)) return 0;
    const result = await this.sql.query(
      `update scheduled_tasks
          set status = 'cancelled', finished_at = now(), updated_at = now()
        where tenant_id = $1 and group_key = $2 and status = 'pending' and ($3::text is null or dedupe_key <> $3)`,
      [tenantId, groupKey, except ?? null]
    );
    return result.rowCount;
  }

  public async advanceGroup(tenantId: string, groupKey: string, to: Date): Promise<Date[]> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<{ was: Date | string }>(
      `with target as (
         select id, due_at as was from scheduled_tasks
          where tenant_id = $1 and group_key = $2 and status = 'pending' and due_at > $3
          for update
       )
       update scheduled_tasks t set due_at = $3, updated_at = now() from target where t.id = target.id
       returning target.was`,
      [tenantId, groupKey, to.toISOString()]
    );
    return result.rows.map((row) => new Date(row.was));
  }

  public async claimDue(now: Date, limit: number, leaseMs: number): Promise<ScheduledTask[]> {
    const result = await this.sql.query<Row>(
      `update scheduled_tasks t
          set status = 'running', attempts = t.attempts + 1,
              locked_until = $1::timestamptz + ($3::int * interval '1 millisecond'), updated_at = now()
         from (select id from scheduled_tasks
                where (status = 'pending' and due_at <= $1::timestamptz)
                   or (status = 'running' and locked_until < $1::timestamptz)
                order by due_at
                limit $2
                for update skip locked) due
        where t.id = due.id
       returning ${COLUMNS.split(", ").map((column) => `t.${column}`).join(", ")}`,
      [now.toISOString(), limit, leaseMs]
    );
    return result.rows.map(toTask).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  public async complete(id: string, now: Date): Promise<void> {
    await this.sql.query(
      "update scheduled_tasks set status = 'done', finished_at = $2, locked_until = null, last_error = null, updated_at = now() where id = $1 and status = 'running'",
      [id, now.toISOString()]
    );
  }

  public async retry(id: string, error: string, nextDueAt: Date): Promise<void> {
    await this.sql.query(
      "update scheduled_tasks set status = 'pending', due_at = $3, last_error = $2, locked_until = null, updated_at = now() where id = $1 and status = 'running'",
      [id, error, nextDueAt.toISOString()]
    );
  }

  public async fail(id: string, error: string, now: Date): Promise<void> {
    await this.sql.query(
      "update scheduled_tasks set status = 'failed', last_error = $2, finished_at = $3, locked_until = null, updated_at = now() where id = $1 and status = 'running'",
      [id, error, now.toISOString()]
    );
  }

  public async peekNext(): Promise<{ dueAt: Date; tenantId: string } | null> {
    const result = await this.sql.query<{ due_at: Date | string; tenant_id: string }>(
      "select due_at, tenant_id from scheduled_tasks where status = 'pending' and kind <> $1 order by due_at limit 1",
      [CHAIN_TASK_KIND]
    );
    const row = result.rows[0];
    return row ? { dueAt: new Date(toIso(row.due_at)), tenantId: row.tenant_id } : null;
  }

  public async purgeFinished(before: Date, limit: number): Promise<number> {
    const result = await this.sql.query(
      `delete from scheduled_tasks
        where id in (select id from scheduled_tasks where finished_at is not null and finished_at < $1 order by finished_at limit $2)`,
      [before.toISOString(), limit]
    );
    return result.rowCount;
  }
}
