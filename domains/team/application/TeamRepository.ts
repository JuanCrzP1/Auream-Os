import type { Role } from "../../../platform/authorization/contracts/Role";
import type { TeamRole } from "../../../contracts/TeamContracts";

// ---------------------------------------------------------------------------
// TeamRepository — puerto. Los miembros activos de una cuenta, con lo que se
// muestra de cada uno (nombre, correo y foto, de su perfil). Implementación
// SQL: `infrastructure/persistence/sql/SqlTeamRepository.ts`.
//
// «Siempre queda al menos un dueño» es una regla del dominio que solo se puede
// garantizar dentro de la base (dos dueños bajándose a la vez): por eso
// `changeRole` y `removeMember` la cumplen de forma atómica y lo dicen.
// ---------------------------------------------------------------------------

export interface TeamMemberRecord {
  readonly userId: string;
  readonly role: Role;
  /** Desde cuándo está en la cuenta (ISO). */
  readonly joinedAt: string;
  readonly lastSeenAt: string | null;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly photoUrl: string | null;
}

export type ChangeRoleOutcome = "changed" | "last_owner" | "not_found";
export type RemoveMemberOutcome = "removed" | "last_owner" | "not_found";

export interface TeamRepository {
  /** Miembros activos de la cuenta, del más antiguo al más nuevo. */
  listMembers(tenantId: string): Promise<ReadonlyArray<TeamMemberRecord>>;
  /** El miembro activo, o `null`. */
  findMember(tenantId: string, userId: string): Promise<TeamMemberRecord | null>;
  /** ¿Ya hay un miembro activo con ese correo? */
  hasMemberWithEmail(tenantId: string, email: string): Promise<boolean>;
  /** Cambia el rol, salvo que la cuenta se quedara sin dueño (`last_owner`). */
  changeRole(tenantId: string, userId: string, role: TeamRole): Promise<ChangeRoleOutcome>;
  /** Le quita el acceso (membresía revocada; sus chats y datos quedan), salvo que sea el último dueño. */
  removeMember(tenantId: string, userId: string): Promise<RemoveMemberOutcome>;
  /** Anota que la persona usó la app en esta cuenta (como mucho una vez por minuto). */
  touchLastSeen(tenantId: string, userId: string): Promise<void>;
}
