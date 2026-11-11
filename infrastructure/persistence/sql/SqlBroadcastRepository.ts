import type { BroadcastStatus } from "../../../contracts/BroadcastResultsContracts";
import type { BroadcastPatch, BroadcastRepository } from "../../../domains/broadcasts/application/BroadcastPorts";
import type { Broadcast } from "../../../domains/broadcasts/domain/Broadcast";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlBroadcastRepository — `broadcasts` (034). Los cambios de estado son
// condicionales («solo si está en…»): si dos rondas de la cola llegan a la
// vez, una sola gana.
// ---------------------------------------------------------------------------

interface Row {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly status: BroadcastStatus;
  readonly status_reason: string | null;
  readonly parent_id: string | null;
  readonly variants: Broadcast["variants"];
  readonly audience: Broadcast["audience"];
  readonly connection_ids: string[];
  readonly settings: Broadcast["settings"];
  readonly ab_test: Broadcast["abTest"];
  readonly follow_up: Broadcast["followUp"];
  readonly winner: number | null;
  readonly decides_at: Date | null;
  readonly follow_up_due_at: Date | null;
  readonly follow_up_child_id: string | null;
  readonly scheduled_at: Date | null;
  readonly started_at: Date | null;
  readonly finished_at: Date | null;
  readonly created_by: string | null;
  readonly created_at: Date;
}

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

function toBroadcast(row: Row): Broadcast {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    status: row.status,
    statusReason: row.status_reason,
    parentId: row.parent_id,
    variants: row.variants,
    audience: row.audience,
    connectionIds: row.connection_ids,
    settings: row.settings,
    abTest: row.ab_test,
    followUp: row.follow_up,
    winner: row.winner,
    decidesAt: iso(row.decides_at),
    followUpDueAt: iso(row.follow_up_due_at),
    followUpChildId: row.follow_up_child_id,
    scheduledAt: iso(row.scheduled_at),
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString()
  };
}

const PATCH_COLUMNS: Readonly<Record<keyof BroadcastPatch, string>> = {
  statusReason: "status_reason",
  startedAt: "started_at",
  finishedAt: "finished_at",
  winner: "winner",
  decidesAt: "decides_at",
  followUpDueAt: "follow_up_due_at",
  followUpChildId: "follow_up_child_id"
};

/** `set status_reason = $5, …` desde el parche (solo las claves presentes). */
function patchSql(patch: BroadcastPatch, firstParam: number): { readonly sql: string; readonly values: unknown[] } {
  const entries = (Object.keys(PATCH_COLUMNS) as Array<keyof BroadcastPatch>).filter((key) => patch[key] !== undefined);
  return {
    sql: entries.map((key, index) => `, ${PATCH_COLUMNS[key]} = $${firstParam + index}`).join(""),
    values: entries.map((key) => patch[key])
  };
}

export class SqlBroadcastRepository implements BroadcastRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async create(broadcast: Broadcast): Promise<void> {
    await this.sql.query(
      `insert into broadcasts (id, tenant_id, name, status, parent_id, variants, audience, connection_ids, settings, ab_test, follow_up, scheduled_at, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::uuid[], $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14)
       on conflict do nothing`,
      [
        broadcast.id,
        broadcast.tenantId,
        broadcast.name,
        broadcast.status,
        broadcast.parentId,
        JSON.stringify(broadcast.variants),
        JSON.stringify(broadcast.audience),
        broadcast.connectionIds,
        JSON.stringify(broadcast.settings),
        broadcast.abTest ? JSON.stringify(broadcast.abTest) : null,
        broadcast.followUp ? JSON.stringify(broadcast.followUp) : null,
        broadcast.scheduledAt,
        broadcast.createdBy,
        broadcast.createdAt
      ]
    );
  }

  public async find(tenantId: string, id: string): Promise<Broadcast | null> {
    const result = await this.sql.query<Row>("select * from broadcasts where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rows[0] ? toBroadcast(result.rows[0]) : null;
  }

  public async list(tenantId: string, limit: number): Promise<ReadonlyArray<Broadcast>> {
    const result = await this.sql.query<Row>("select * from broadcasts where tenant_id = $1 order by created_at desc limit $2", [tenantId, limit]);
    return result.rows.map(toBroadcast);
  }

  public async transition(tenantId: string, id: string, from: ReadonlyArray<BroadcastStatus>, to: BroadcastStatus, patch: BroadcastPatch = {}): Promise<boolean> {
    const set = patchSql(patch, 5);
    const result = await this.sql.query(
      `update broadcasts set status = $4, updated_at = now()${set.sql} where tenant_id = $1 and id = $2 and status = any($3::text[])`,
      [tenantId, id, from, to, ...set.values]
    );
    return (result.rowCount ?? 0) > 0;
  }

  public async update(tenantId: string, id: string, patch: BroadcastPatch): Promise<void> {
    const set = patchSql(patch, 3);
    if (!set.sql) return;
    await this.sql.query(`update broadcasts set updated_at = now()${set.sql} where tenant_id = $1 and id = $2`, [tenantId, id, ...set.values]);
  }

  public async childOf(tenantId: string, parentId: string): Promise<string | null> {
    const result = await this.sql.query<{ id: string }>("select id from broadcasts where tenant_id = $1 and parent_id = $2", [tenantId, parentId]);
    return result.rows[0]?.id ?? null;
  }
}
