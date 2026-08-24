import type { Membership, MembershipStatus } from "../../../domains/team/contracts/Membership";
import type {
  MembershipRepository,
  MembershipWithTenant
} from "../../../domains/team/application/MembershipRepository";
import type { Role } from "../../../platform/authorization/contracts/Role";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlMembershipRepository
//
// Responsabilidad única: leer memberships de PostgreSQL. Sin reglas de negocio.
//
// Ambas consultas filtran por `status = 'active'`: una membership invitada o
// revocada no otorga acceso, y ese filtro vive aquí para que ningún llamador
// pueda olvidarlo. También exigen `tenants.status = 'active'`: un tenant
// suspendido no debe otorgar acceso aunque la membership siga activa.
// ---------------------------------------------------------------------------

interface MembershipRow {
  readonly user_id: string;
  readonly tenant_id: string;
  readonly role: string;
  readonly status: string;
}

interface MembershipWithTenantRow extends MembershipRow {
  readonly tenant_key: string;
  readonly tenant_name: string;
}

function toMembership(row: MembershipRow): Membership {
  return {
    userId: row.user_id,
    tenantId: row.tenant_id,
    role: row.role as Role,
    status: row.status as MembershipStatus
  };
}

export class SqlMembershipRepository implements MembershipRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async findActive(userId: string, tenantId: string): Promise<Membership | null> {
    const result = await this.sql.query<MembershipRow>(
      `select m.user_id, m.tenant_id, m.role, m.status
         from memberships m
         join tenants t on t.id = m.tenant_id
        where m.user_id = $1 and m.tenant_id = $2
          and m.status = 'active' and t.status = 'active'`,
      [userId, tenantId]
    );

    return result.rows[0] ? toMembership(result.rows[0]) : null;
  }

  public async findActiveByUser(userId: string): Promise<ReadonlyArray<MembershipWithTenant>> {
    const result = await this.sql.query<MembershipWithTenantRow>(
      `select m.user_id, m.tenant_id, m.role, m.status,
              t.key as tenant_key, t.name as tenant_name
         from memberships m
         join tenants t on t.id = m.tenant_id
        where m.user_id = $1 and m.status = 'active' and t.status = 'active'
        order by t.name`,
      [userId]
    );

    return result.rows.map((row) => ({
      membership: toMembership(row),
      tenantKey: row.tenant_key,
      tenantName: row.tenant_name
    }));
  }
}
