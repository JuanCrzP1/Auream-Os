import { randomUUID } from "node:crypto";
import type {
  ChangeMemberRoleRequest,
  CreateInvitationRequest,
  InvitationLinkResponse,
  TeamInvitationSummary,
  TeamActivityResponse,
  TeamMemberSummary,
  TeamResponse,
  TeamRole
} from "../../../contracts/TeamContracts";
import { TEAM_ROLES, isTeamRole } from "../../../contracts/TeamContracts";
import { AccessError } from "../../../platform/authorization/domain/AccessError";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { MAX_PENDING_INVITATIONS, invitationExpiry, isInvitationExpired, normalizeInvitationEmail, type Invitation } from "../domain/Invitation";
import { assignableRoles, canAssign, canManageInvitation, canManageMember, teamRoleOf } from "../domain/TeamPolicy";
import type { InvitationRepository } from "./InvitationRepository";
import type { TeamActivityEntry, TeamActivityLog } from "./TeamActivityLog";
import { hashInvitationToken, newInvitationToken } from "./InvitationToken";
import type { TeamMemberRecord, TeamRepository } from "./TeamRepository";

// ---------------------------------------------------------------------------
// El equipo visto por quien lo administra (Configuración → Equipo): ver,
// invitar con enlace, renovar o cancelar invitaciones, cambiar roles y quitar.
//
// El scope `team.manage` lo exige la ruta; aquí se decide A QUIÉN puede tocar
// cada uno (`TeamPolicy`) con su rol real en la cuenta, leído de la base.
// ---------------------------------------------------------------------------

/** Quien hace la petición: su cuenta y su usuario, de la identidad verificada. */
export interface TeamActor {
  readonly tenantId: string;
  readonly userId: string;
}

const rank = (role: TeamRole) => TEAM_ROLES.indexOf(role);

export class TeamServices {
  public constructor(
    private readonly members: TeamRepository,
    private readonly invitations: InvitationRepository,
    private readonly log: TeamActivityLog,
    private readonly now: () => Date = () => new Date(),
    private readonly newToken: () => string = newInvitationToken
  ) {}

  public async list(actor: TeamActor): Promise<TeamResponse> {
    const me = await this.requireMe(actor);
    const [members, pending] = await Promise.all([this.members.listMembers(actor.tenantId), this.invitations.listPending(actor.tenantId)]);
    return {
      members: members
        .flatMap((member) => this.toMember(member, me.role, actor.userId))
        .sort((a, b) => rank(a.role) - rank(b.role) || a.joinedAt.localeCompare(b.joinedAt)),
      invitations: pending.map(({ invitation, invitedByName }) => this.toInvitation(invitation, invitedByName, me.role)),
      myRole: me.role,
      assignableRoles: assignableRoles(me.role)
    };
  }

  public async invite(actor: TeamActor, input: Partial<CreateInvitationRequest>): Promise<InvitationLinkResponse> {
    const me = await this.requireMe(actor);
    const email = normalizeInvitationEmail(input.email);
    if (!email) throw new ValidationError("Escribe un correo válido.");
    if (!isTeamRole(input.role)) throw new ValidationError("Elige un rol.");
    if (!canAssign(me.role, input.role)) throw new AccessError("Tu rol no puede invitar con ese rol.");
    if (await this.members.hasMemberWithEmail(actor.tenantId, email)) throw new ConflictError("Esa persona ya está en tu equipo.");

    // Invitar de nuevo al mismo correo renueva su invitación (enlace y rol nuevos).
    const existing = await this.invitations.findPendingByEmail(actor.tenantId, email);
    if (existing && !canManageInvitation(me.role, existing.role)) throw new AccessError("Ya tiene una invitación que tu rol no puede cambiar.");
    if (!existing && (await this.invitations.countLivePending(actor.tenantId, this.now())) >= MAX_PENDING_INVITATIONS) {
      throw new ConflictError("Tienes demasiadas invitaciones pendientes. Cancela las que ya no uses.");
    }
    const now = this.now();
    const link = await this.issue(
      { id: existing?.id ?? randomUUID(), tenantId: actor.tenantId, email, role: input.role, tokenHash: "", status: "pending", invitedBy: actor.userId, createdAt: now.toISOString(), expiresAt: "", acceptedBy: null, acceptedAt: null },
      me
    );
    await this.note({ tenantId: actor.tenantId, actorId: actor.userId, action: existing ? "invitation_renewed" : "invited", targetEmail: email, role: input.role });
    return link;
  }

  /** Enlace nuevo (el anterior deja de servir) y 7 días más. Sirve también para una vencida. */
  public async renew(actor: TeamActor, invitationId: string): Promise<InvitationLinkResponse> {
    const me = await this.requireMe(actor);
    const invitation = await this.requirePending(actor.tenantId, invitationId);
    if (!canManageInvitation(me.role, invitation.role)) throw new AccessError("Tu rol no puede cambiar esta invitación.");
    const link = await this.issue({ ...invitation, invitedBy: actor.userId }, me);
    await this.note({ tenantId: actor.tenantId, actorId: actor.userId, action: "invitation_renewed", targetEmail: invitation.email, role: invitation.role });
    return link;
  }

  public async revoke(actor: TeamActor, invitationId: string): Promise<void> {
    const me = await this.requireMe(actor);
    const invitation = await this.requirePending(actor.tenantId, invitationId);
    if (!canManageInvitation(me.role, invitation.role)) throw new AccessError("Tu rol no puede cancelar esta invitación.");
    await this.invitations.save({ ...invitation, status: "revoked" });
    await this.note({ tenantId: actor.tenantId, actorId: actor.userId, action: "invitation_revoked", targetEmail: invitation.email, role: invitation.role });
  }

  public async changeRole(actor: TeamActor, userId: string, input: Partial<ChangeMemberRoleRequest>): Promise<TeamResponse> {
    const me = await this.requireMe(actor);
    if (!isTeamRole(input.role)) throw new ValidationError("Elige un rol.");
    const target = await this.requireManageable(actor, me.role, userId, "No puedes cambiar tu propio rol.");
    if (!canAssign(me.role, input.role)) throw new AccessError("Tu rol no puede dar ese rol.");
    if (target !== input.role) {
      const outcome = await this.members.changeRole(actor.tenantId, userId, input.role);
      if (outcome === "not_found") throw new NotFoundError("Esa persona ya no está en el equipo.");
      if (outcome === "last_owner") throw new ConflictError("Debe quedar al menos un dueño en la cuenta.");
      await this.note({ tenantId: actor.tenantId, actorId: actor.userId, action: "role_changed", targetUserId: userId, role: input.role });
    }
    return this.list(actor);
  }

  public async remove(actor: TeamActor, userId: string): Promise<void> {
    const me = await this.requireMe(actor);
    await this.requireManageable(actor, me.role, userId, "No puedes quitarte a ti mismo del equipo.");
    const outcome = await this.members.removeMember(actor.tenantId, userId);
    if (outcome === "not_found") throw new NotFoundError("Esa persona ya no está en el equipo.");
    if (outcome === "last_owner") throw new ConflictError("Debe quedar al menos un dueño en la cuenta.");
    await this.note({ tenantId: actor.tenantId, actorId: actor.userId, action: "removed", targetUserId: userId });
  }

  /** Lo que pasó en el equipo, lo más reciente primero (todo el equipo lo ve). */
  public async activity(actor: TeamActor): Promise<TeamActivityResponse> {
    await this.requireMe(actor);
    return { entries: await this.log.list(actor.tenantId, 50) };
  }

  /** Anota que la persona usó la app en esta cuenta («En línea», «Hace 2 horas»). */
  public async touch(actor: TeamActor): Promise<void> {
    await this.members.touchLastSeen(actor.tenantId, actor.userId);
  }

  /** La acción ya ocurrió: si el registro falla, no se deshace ni se le avisa al usuario. */
  private async note(entry: TeamActivityEntry): Promise<void> {
    try {
      await this.log.record(entry);
    } catch {
      // Sin registro de esta acción; la acción en sí quedó hecha.
    }
  }

  private async issue(base: Invitation, me: { readonly role: TeamRole; readonly displayName: string | null }): Promise<InvitationLinkResponse> {
    const token = this.newToken();
    const invitation: Invitation = { ...base, tokenHash: hashInvitationToken(token), expiresAt: invitationExpiry(this.now()) };
    await this.invitations.save(invitation);
    return { invitation: this.toInvitation(invitation, me.displayName, me.role), token };
  }

  private async requireMe(actor: TeamActor): Promise<{ readonly role: TeamRole; readonly displayName: string | null }> {
    const member = await this.members.findMember(actor.tenantId, actor.userId);
    const role = member ? teamRoleOf(member.role) : null;
    if (!member || !role) throw new AccessError("No perteneces al equipo de esta cuenta.");
    return { role, displayName: member.displayName };
  }

  private async requirePending(tenantId: string, invitationId: string): Promise<Invitation> {
    const invitation = await this.invitations.findById(tenantId, invitationId);
    if (!invitation || invitation.status !== "pending") throw new NotFoundError("Esa invitación ya no está pendiente.");
    return invitation;
  }

  /** El rol del miembro que se quiere tocar, si `me` puede tocarlo. */
  private async requireManageable(actor: TeamActor, me: TeamRole, userId: string, selfMessage: string): Promise<TeamRole> {
    if (userId === actor.userId) throw new AccessError(selfMessage);
    const target = await this.members.findMember(actor.tenantId, userId);
    const role = target ? teamRoleOf(target.role) : null;
    if (!role) throw new NotFoundError("Esa persona no está en el equipo.");
    if (!canManageMember(me, role, false)) throw new AccessError("Tu rol no puede cambiar a esta persona.");
    return role;
  }

  private toMember(member: TeamMemberRecord, me: TeamRole, myUserId: string): TeamMemberSummary[] {
    const role = teamRoleOf(member.role);
    if (!role) return [];
    const isYou = member.userId === myUserId;
    return [{ userId: member.userId, displayName: member.displayName, email: member.email, photoUrl: member.photoUrl, role, joinedAt: member.joinedAt, lastSeenAt: member.lastSeenAt, isYou, canManage: canManageMember(me, role, isYou) }];
  }

  private toInvitation(invitation: Invitation, invitedByName: string | null, me: TeamRole): TeamInvitationSummary {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      invitedByName,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      expired: isInvitationExpired(invitation, this.now()),
      canManage: canManageInvitation(me, invitation.role)
    };
  }
}
