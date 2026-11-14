import type { BusinessDataType } from "../../../contracts/BusinessDataContracts";
import { BUSINESS_HISTORY_LIMIT, type BusinessDataChange, type BusinessDataChangeDetail, type BusinessDataSchedule } from "../../../contracts/BusinessDataTimeline";
import type { DatumLog, ScheduleSaved } from "../../../domains/business-data/application/BusinessDataPorts";
import type { ScheduleShape } from "../../../domains/business-data/domain/DatumSchedule";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Datos del negocio en el tiempo, en PostgreSQL: los cambios programados
// (`business_data_schedules`) y el historial (`business_data_changes`). Cada
// escritura va dentro de la transacción del cambio, con el dato bloqueado:
// el historial nunca queda sin su línea y dos programados no se cruzan aunque
// dos personas guarden a la vez.
// ---------------------------------------------------------------------------

/** Los programados por venir o activos de cada dato (`d`), como JSON, del más próximo al más lejano. */
export const OPEN_SCHEDULES_SQL = `coalesce((
    select json_agg(json_build_object('id', s.id, 'value', s.value, 'startsAt', s.starts_at, 'endsAt', s.ends_at, 'note', s.note,
                                      'createdBy', coalesce(u.display_name, u.email), 'createdAt', s.created_at) order by s.starts_at)
      from business_data_schedules s
      left join user_profiles u on u.user_id::text = s.created_by
     where s.tenant_id = d.tenant_id and s.datum_id = d.id and s.ends_at > now()
  ), '[]'::json)`;

type ScheduleJson = Omit<BusinessDataSchedule, "startsAt" | "endsAt" | "createdAt"> & { startsAt: string; endsAt: string; createdAt: string };

export const toSchedules = (json: unknown): BusinessDataSchedule[] =>
  (Array.isArray(json) ? (json as ScheduleJson[]) : []).map((s) => ({ id: s.id, value: s.value, startsAt: toIso(s.startsAt), endsAt: toIso(s.endsAt), note: s.note, createdBy: s.createdBy ?? null, createdAt: toIso(s.createdAt) }));

interface LockedDatum {
  readonly key: string;
  readonly type: BusinessDataType;
}

/** Bloquea el dato hasta el final de la transacción. `null` si no es de la cuenta. */
export async function lockDatum(tx: SqlExecutor, tenantId: string, datumId: string): Promise<LockedDatum | null> {
  if (!isUuid(datumId)) return null;
  const { rows } = await tx.query<LockedDatum>(`select key, type from business_data where tenant_id = $1 and id = $2 for update`, [tenantId, datumId]);
  return rows[0] ?? null;
}

/** Anota las líneas (cada una con su hora, en orden) y deja solo las últimas 50 de esa clave. */
export async function writeLog(tx: SqlExecutor, tenantId: string, datum: LockedDatum, log: DatumLog, newId: () => string): Promise<void> {
  if (log.changes.length === 0) return;
  for (const change of log.changes) {
    const { kind, ...detail } = change;
    await tx.query(
      `insert into business_data_changes (id, tenant_id, datum_key, kind, detail, value_type, actor_id, created_at) values ($1, $2, $3, $4, $5::jsonb, $6, $7, clock_timestamp())`,
      [newId(), tenantId, datum.key, kind, JSON.stringify(detail), datum.type, log.actorId]
    );
  }
  await tx.query(
    `delete from business_data_changes where tenant_id = $1 and datum_key = $2
        and id not in (select id from business_data_changes where tenant_id = $1 and datum_key = $2 order by created_at desc limit $3)`,
    [tenantId, datum.key, BUSINESS_HISTORY_LIMIT]
  );
}

export async function saveSchedule(tx: SqlExecutor, tenantId: string, datumId: string, scheduleId: string, schedule: ScheduleShape, log: DatumLog, newId: () => string): Promise<ScheduleSaved> {
  const datum = await lockDatum(tx, tenantId, datumId);
  if (!datum || !isUuid(scheduleId)) return "missing";
  const clash = await tx.query(
    `select 1 from business_data_schedules where tenant_id = $1 and datum_id = $2 and id <> $3 and ends_at > now() and starts_at < $5 and ends_at > $4 limit 1`,
    [tenantId, datumId, scheduleId, schedule.startsAt, schedule.endsAt]
  );
  if (clash.rowCount > 0) return "overlap";
  const saved = await tx.query(
    `insert into business_data_schedules (id, tenant_id, datum_id, value, starts_at, ends_at, note, created_by) values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (id) do update set value = excluded.value, starts_at = excluded.starts_at, ends_at = excluded.ends_at, note = excluded.note, updated_at = now()
      where business_data_schedules.tenant_id = excluded.tenant_id and business_data_schedules.datum_id = excluded.datum_id`,
    [scheduleId, tenantId, datumId, schedule.value, schedule.startsAt, schedule.endsAt, schedule.note, log.actorId]
  );
  if (saved.rowCount === 0) return "missing";
  // Los que terminaron hace más de 90 días ya solo viven en el historial.
  await tx.query(`delete from business_data_schedules where tenant_id = $1 and datum_id = $2 and ends_at < now() - interval '90 days'`, [tenantId, datumId]);
  await writeLog(tx, tenantId, datum, log, newId);
  return "saved";
}

export async function closeSchedule(tx: SqlExecutor, tenantId: string, datumId: string, scheduleId: string, how: "unscheduled" | "ended", at: Date, log: DatumLog, newId: () => string): Promise<boolean> {
  const datum = await lockDatum(tx, tenantId, datumId);
  if (!datum || !isUuid(scheduleId)) return false;
  const closed =
    how === "unscheduled"
      ? await tx.query(`delete from business_data_schedules where tenant_id = $1 and datum_id = $2 and id = $3 and starts_at > $4`, [tenantId, datumId, scheduleId, at])
      : await tx.query(
          `update business_data_schedules set ends_at = $4, updated_at = now() where tenant_id = $1 and datum_id = $2 and id = $3 and starts_at < $4 and ends_at > $4`,
          [tenantId, datumId, scheduleId, at]
        );
  if (closed.rowCount === 0) return false;
  await writeLog(tx, tenantId, datum, log, newId);
  return true;
}

interface ChangeRow {
  readonly id: string;
  readonly kind: BusinessDataChangeDetail["kind"];
  readonly detail: Record<string, unknown>;
  readonly value_type: BusinessDataType;
  readonly actor_name: string | null;
  readonly created_at: Date | string;
}

export async function history(sql: SqlExecutor, tenantId: string, key: string, limit: number): Promise<BusinessDataChange[]> {
  const { rows } = await sql.query<ChangeRow>(
    `select c.id, c.kind, c.detail, c.value_type, coalesce(u.display_name, u.email) as actor_name, c.created_at
       from business_data_changes c
       left join user_profiles u on u.user_id::text = c.actor_id
      where c.tenant_id = $1 and c.datum_key = $2
      order by c.created_at desc
      limit $3`,
    [tenantId, key, limit]
  );
  return rows.map((row) => ({ ...(row.detail as object), kind: row.kind, id: row.id, at: toIso(row.created_at), actorName: row.actor_name, valueType: row.value_type }) as BusinessDataChange);
}
