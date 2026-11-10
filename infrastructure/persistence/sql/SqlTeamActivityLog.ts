import type { TeamActivityAction, TeamRole } from "../../../contracts/TeamContracts";
import type { TeamActivityEntry, TeamActivityLog, TeamActivityRecord } from "../../../domains/team/application/TeamActivityLog";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlTeamActivityLog — `team_activity` (030). Quién hizo qué en el equipo,
// con el nombre (o correo) de cada persona tomado de `user_profiles` al leer.
// ---------------------------------------------------------------------------

interface ActivityRow {
  readonly id: string;
  readonly action: string;
  readonly role: string | null;
  readonly created_at: Date | string;
  readonly actor_name: string | null;
  readonly target_name: string | null;
}

export class SqlTeamActivityLog implements TeamActivityLog {
  public constructor(private readonly sql: SqlExecutor) {}

  public async record(entry: TeamActivityEntry): Promise<void> {
    await this.sql.query(
      `insert into team_activity (tenant_id, actor_id, action, target_user_id, target_email, role)
       values ($1, $2, $3, $4, $5, $6)`,
      [entry.tenantId, entry.actorId, entry.action, entry.targetUserId ?? null, entry.targetEmail ?? null, entry.role ?? null]
    );
  }

  public async list(tenantId: string, limit: number): Promise<ReadonlyArray<TeamActivityRecord>> {
    const result = await this.sql.query<ActivityRow>(
      `select a.id, a.action, a.role, a.created_at,
              coalesce(actor.display_name, actor.email) as actor_name,
              coalesce(a.target_email, target.display_name, target.email) as target_name
         from team_activity a
         left join user_profiles actor on actor.user_id = a.actor_id
         left join user_profiles target on target.user_id = a.target_user_id
        where a.tenant_id = $1
        order by a.created_at desc
        limit $2`,
      [tenantId, limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      action: row.action as TeamActivityAction,
      actorName: row.actor_name,
      targetName: row.target_name,
      role: row.role as TeamRole | null,
      at: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString()
    }));
  }
}
