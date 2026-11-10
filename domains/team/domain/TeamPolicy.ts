import type { Role } from "../../../platform/authorization/contracts/Role";
import type { TeamRole } from "../../../contracts/TeamContracts";

// ---------------------------------------------------------------------------
// TeamPolicy — quién puede tocar a quién en el equipo. Reglas fijas, como en
// las plataformas profesionales:
//
//   · Dueño: invita, cambia y quita a cualquiera, y puede nombrar dueños.
//   · Administrador: invita, cambia y quita a administradores, asesores y
//     solo lectura; nunca toca a un dueño ni nombra dueños.
//   · Asesor y Solo lectura: ven el equipo, no lo cambian.
//   · Nadie se cambia el rol ni se quita a sí mismo desde aquí.
//   · Siempre queda al menos un dueño (lo comprueban los casos de uso, que
//     saben cuántos hay).
//
// El scope `team.manage` dice si alguien administra el equipo; esta política
// dice A QUIÉN. Funciones puras: sin base de datos ni HTTP.
// ---------------------------------------------------------------------------

const FOR_OWNERS: ReadonlyArray<TeamRole> = ["tenant_owner", "tenant_admin", "operator", "viewer"];
const FOR_ADMINS: ReadonlyArray<TeamRole> = ["tenant_admin", "operator", "viewer"];

/**
 * El rol de equipo de una membresía. `platform_admin` actúa como dueño; las
 * credenciales de máquina no forman parte de un equipo.
 */
export function teamRoleOf(role: Role): TeamRole | null {
  if (role === "platform_admin") return "tenant_owner";
  if (role === "tenant_owner" || role === "tenant_admin" || role === "operator" || role === "viewer") return role;
  return null;
}

/** Roles que puede dar quien tiene `actor`, al invitar o al cambiar a alguien. */
export function assignableRoles(actor: TeamRole): ReadonlyArray<TeamRole> {
  if (actor === "tenant_owner") return FOR_OWNERS;
  if (actor === "tenant_admin") return FOR_ADMINS;
  return [];
}

export function canAssign(actor: TeamRole, role: TeamRole): boolean {
  return assignableRoles(actor).includes(role);
}

/** Si `actor` puede cambiar o quitar a un miembro con rol `target`. Nunca a sí mismo. */
export function canManageMember(actor: TeamRole, target: TeamRole, isSelf: boolean): boolean {
  if (isSelf) return false;
  if (actor === "tenant_owner") return true;
  if (actor === "tenant_admin") return target !== "tenant_owner";
  return false;
}

/** Una invitación la renueva o cancela quien podría haberla hecho con ese rol. */
export function canManageInvitation(actor: TeamRole, invitedRole: TeamRole): boolean {
  return canAssign(actor, invitedRole);
}
