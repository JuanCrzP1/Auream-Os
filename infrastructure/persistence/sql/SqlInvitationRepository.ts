import type { TeamRole } from "../../../contracts/TeamContracts";
import type { Invitation, InvitationStatus } from "../../../domains/team/domain/Invitation";
import type {
  AcceptOutcome,
  InvitationPreviewRecord,
  InvitationRepository,
  InvitationWithInviter
} from "../../../domains/team/application/InvitationRepository";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlInvitationRepository — `team_invitations` (029). Sin reglas de negocio:
// aceptar es atómico (marca la invitación solo si sigue pendiente y sin
// vencer, y crea o reactiva la membresía en la misma transacción).
// ---------------------------------------------------------------------------

interface InvitationRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly email: string;
  readonly role: string;
  readonly token_hash: string;
  readonly status: string;
  readonly invited_by: string;
  readonly created_at: Date | string;
  readonly expires_at: Date | string;
  readonly accepted_by: string | null;
  readonly accepted_at: Date | string | null;
}

const COLUMNS = "i.id, i.tenant_id, i.email, i.role, i.token_hash, i.status, i.invited_by, i.created_at, i.expires_at, i.accepted_by, i.accepted_at";

const iso = (value: Date | string) => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    role: row.role as TeamRole,
    tokenHash: row.token_hash,
    status: row.status as InvitationStatus,
    invitedBy: row.invited_by,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at ? iso(row.accepted_at) : null
  };
}

export class SqlInvitationRepository implements InvitationRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async listPending(tenantId: string): Promise<ReadonlyArray<InvitationWithInviter>> {
    const result = await this.sql.query<InvitationRow & { readonly invited_by_name: string | null }>(
      `select ${COLUMNS}, p.display_name as invited_by_name
         from team_invitations i
         left join user_profiles p on p.user_id = i.invited_by
        where i.tenant_id = $1 and i.status = 'pending'
        order by i.created_at desc`,
      [tenantId]
    );
    return result.rows.map((row) => ({ invitation: toInvitation(row), invitedByName: row.invited_by_name }));
  }

  public async countLivePending(tenantId: string, now: Date): Promise<number> {
    const result = await this.sql.query<{ readonly total: number }>(
      "select count(*)::int as total from team_invitations where tenant_id = $1 and status = 'pending' and expires_at > $2",
      [tenantId, now.toISOString()]
    );
    return result.rows[0]?.total ?? 0;
  }

  public async findById(tenantId: string, id: string): Promise<Invitation | null> {
    const result = await this.sql.query<InvitationRow>(`select ${COLUMNS} from team_invitations i where i.tenant_id = $1 and i.id = $2`, [tenantId, id]);
    return result.rows[0] ? toInvitation(result.rows[0]) : null;
  }

  public async findPendingByEmail(tenantId: string, email: string): Promise<Invitation | null> {
    const result = await this.sql.query<InvitationRow>(
      `select ${COLUMNS} from team_invitations i where i.tenant_id = $1 and i.email = $2 and i.status = 'pending'`,
      [tenantId, email]
    );
    return result.rows[0] ? toInvitation(result.rows[0]) : null;
  }

  public async findPreviewByTokenHash(tokenHash: string): Promise<InvitationPreviewRecord | null> {
    const result = await this.sql.query<InvitationRow & { readonly company_name: string; readonly company_logo_url: string | null; readonly inviter_name: string | null }>(
      `select ${COLUMNS}, t.name as company_name, t.logo_url as company_logo_url, p.display_name as inviter_name
         from team_invitations i
         join tenants t on t.id = i.tenant_id and t.status = 'active'
         left join user_profiles p on p.user_id = i.invited_by
        where i.token_hash = $1`,
      [tokenHash]
    );
    const row = result.rows[0];
    return row ? { invitation: toInvitation(row), companyName: row.company_name, companyLogoUrl: row.company_logo_url, inviterName: row.inviter_name } : null;
  }

  public async save(invitation: Invitation): Promise<void> {
    try {
      await this.write(invitation);
    } catch (error) {
      // Dos invitaciones al mismo correo a la vez: la segunda choca con el índice de pendientes.
      if ((error as { code?: string } | null)?.code === "23505") throw new ConflictError("Esa persona ya tiene una invitación pendiente.");
      throw error;
    }
  }

  private async write(invitation: Invitation): Promise<void> {
    await this.sql.query(
      `insert into team_invitations (id, tenant_id, email, role, token_hash, status, invited_by, created_at, expires_at, accepted_by, accepted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update
         set role = excluded.role, token_hash = excluded.token_hash, status = excluded.status,
             invited_by = excluded.invited_by, created_at = excluded.created_at, expires_at = excluded.expires_at,
             accepted_by = excluded.accepted_by, accepted_at = excluded.accepted_at, updated_at = now()
       where team_invitations.tenant_id = excluded.tenant_id`,
      [
        invitation.id,
        invitation.tenantId,
        invitation.email,
        invitation.role,
        invitation.tokenHash,
        invitation.status,
        invitation.invitedBy,
        invitation.createdAt,
        invitation.expiresAt,
        invitation.acceptedBy,
        invitation.acceptedAt
      ]
    );
  }

  public async accept(invitationId: string, userId: string, at: Date): Promise<AcceptOutcome> {
    return this.sql.transaction(async (tx) => {
      const claimed = await tx.query<{ readonly tenant_id: string; readonly role: string }>(
        `update team_invitations
            set status = 'accepted', accepted_by = $2, accepted_at = $3, updated_at = now()
          where id = $1 and status = 'pending' and expires_at > $3
          returning tenant_id, role`,
        [invitationId, userId, at.toISOString()]
      );
      const invitation = claimed.rows[0];
      if (!invitation) return "not_pending";

      const current = await tx.query<{ readonly status: string }>(
        "select status from memberships where user_id = $1 and tenant_id = $2 for update",
        [userId, invitation.tenant_id]
      );
      if (current.rows[0]?.status === "active") return "already_member";

      // Nueva, o de vuelta tras haber salido (la fila revocada se reactiva con el rol invitado).
      await tx.query(
        `insert into memberships (user_id, tenant_id, role, status) values ($1, $2, $3, 'active')
         on conflict (user_id, tenant_id) do update set role = excluded.role, status = 'active', updated_at = now()`,
        [userId, invitation.tenant_id, invitation.role]
      );
      return "joined";
    });
  }
}
