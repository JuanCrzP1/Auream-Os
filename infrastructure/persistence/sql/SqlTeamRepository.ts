import type { Role } from "../../../platform/authorization/contracts/Role";
import type { TeamRole } from "../../../contracts/TeamContracts";
import type {
  ChangeRoleOutcome,
  RemoveMemberOutcome,
  TeamMemberRecord,
  TeamRepository
} from "../../../domains/team/application/TeamRepository";
import type { SqlClient, SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlTeamRepository — los miembros de una cuenta (`memberships` activas) con
// su nombre, correo y foto (`user_profiles`). Sin reglas de negocio, salvo la
// que solo la base puede garantizar: cambiar o quitar a un dueño bloquea las
// filas de los dueños, así dos dueños bajándose a la vez no dejan la cuenta
// sin ninguno.
// ---------------------------------------------------------------------------

interface MemberRow {
  readonly user_id: string;
  readonly role: string;
  readonly created_at: Date | string;
  readonly last_seen_at: Date | string | null;
  readonly display_name: string | null;
  readonly email: string | null;
  readonly photo_url: string | null;
}

const SELECT_MEMBERS = `
  select m.user_id, m.role, m.created_at, m.last_seen_at, p.display_name, p.email, p.photo_url
    from memberships m
    left join user_profiles p on p.user_id = m.user_id
   where m.tenant_id = $1 and m.status = 'active'`;

const iso = (value: Date | string) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());

function toRecord(row: MemberRow): TeamMemberRecord {
  return {
    userId: row.user_id,
    role: row.role as Role,
    joinedAt: iso(row.created_at),
    lastSeenAt: row.last_seen_at ? iso(row.last_seen_at) : null,
    displayName: row.display_name,
    email: row.email,
    photoUrl: row.photo_url
  };
}

type Locked = { readonly role: string } | "not_found" | "last_owner";

/**
 * Bloquea a los dueños de la cuenta y al miembro, y dice si se le puede quitar
 * el rol de dueño sin dejar la cuenta sin ninguno.
 */
async function lockForOwnerChange(tx: SqlExecutor, tenantId: string, userId: string, keepsOwner: boolean): Promise<Locked> {
  const owners = await tx.query<{ readonly user_id: string }>(
    "select user_id from memberships where tenant_id = $1 and status = 'active' and role = 'tenant_owner' for update",
    [tenantId]
  );
  const target = await tx.query<{ readonly role: string }>(
    "select role from memberships where tenant_id = $1 and user_id = $2 and status = 'active' for update",
    [tenantId, userId]
  );
  const row = target.rows[0];
  if (!row) return "not_found";
  if (row.role === "tenant_owner" && !keepsOwner && owners.rows.length <= 1) return "last_owner";
  return row;
}

export class SqlTeamRepository implements TeamRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async listMembers(tenantId: string): Promise<ReadonlyArray<TeamMemberRecord>> {
    const result = await this.sql.query<MemberRow>(`${SELECT_MEMBERS} order by m.created_at`, [tenantId]);
    return result.rows.map(toRecord);
  }

  public async findMember(tenantId: string, userId: string): Promise<TeamMemberRecord | null> {
    const result = await this.sql.query<MemberRow>(`${SELECT_MEMBERS} and m.user_id = $2`, [tenantId, userId]);
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  public async hasMemberWithEmail(tenantId: string, email: string): Promise<boolean> {
    const result = await this.sql.query<{ readonly found: number }>(
      `select 1 as found
         from memberships m
         join user_profiles p on p.user_id = m.user_id
        where m.tenant_id = $1 and m.status = 'active' and p.email = $2
        limit 1`,
      [tenantId, email]
    );
    return result.rows.length > 0;
  }

  public async changeRole(tenantId: string, userId: string, role: TeamRole): Promise<ChangeRoleOutcome> {
    return this.sql.transaction(async (tx) => {
      const locked = await lockForOwnerChange(tx, tenantId, userId, role === "tenant_owner");
      if (typeof locked === "string") return locked;
      await tx.query("update memberships set role = $3, updated_at = now() where tenant_id = $1 and user_id = $2", [tenantId, userId, role]);
      return "changed";
    });
  }

  public async touchLastSeen(tenantId: string, userId: string): Promise<void> {
    // Una escritura por minuto como mucho, aunque lleguen muchas peticiones.
    await this.sql.query(
      `update memberships set last_seen_at = now()
        where tenant_id = $1 and user_id = $2 and status = 'active'
          and (last_seen_at is null or last_seen_at < now() - interval '1 minute')`,
      [tenantId, userId]
    );
  }

  public async removeMember(tenantId: string, userId: string): Promise<RemoveMemberOutcome> {
    return this.sql.transaction(async (tx) => {
      const locked = await lockForOwnerChange(tx, tenantId, userId, false);
      if (typeof locked === "string") return locked;
      await tx.query(
        "update memberships set status = 'revoked', updated_at = now() where tenant_id = $1 and user_id = $2",
        [tenantId, userId]
      );
      return "removed";
    });
  }
}
