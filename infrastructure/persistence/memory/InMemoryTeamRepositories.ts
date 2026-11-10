import type { Role } from "../../../platform/authorization/contracts/Role";
import type { TeamRole } from "../../../contracts/TeamContracts";
import type { Invitation } from "../../../domains/team/domain/Invitation";
import type {
  AcceptOutcome,
  InvitationPreviewRecord,
  InvitationRepository,
  InvitationWithInviter
} from "../../../domains/team/application/InvitationRepository";
import type { ChangeRoleOutcome, RemoveMemberOutcome, TeamMemberRecord, TeamRepository } from "../../../domains/team/application/TeamRepository";

// ---------------------------------------------------------------------------
// Equipo en memoria: pruebas y desarrollo sin base de datos. Un solo estado
// (cuentas, personas, membresías e invitaciones) detrás de los dos puertos,
// como en SQL comparten tablas.
// ---------------------------------------------------------------------------

export interface InMemoryPerson {
  readonly userId: string;
  readonly displayName?: string | null;
  readonly email?: string | null;
  readonly photoUrl?: string | null;
}

interface MembershipState {
  role: Role;
  status: "active" | "revoked";
  joinedAt: string;
}

export class InMemoryTeamStore {
  public readonly companies = new Map<string, { name: string; logoUrl: string | null }>();
  public readonly people = new Map<string, InMemoryPerson>();
  /** `${tenantId}:${userId}` → membresía. */
  public readonly memberships = new Map<string, MembershipState>();
  public readonly invitationsById = new Map<string, Invitation>();

  public addCompany(tenantId: string, name: string, logoUrl: string | null = null): this {
    this.companies.set(tenantId, { name, logoUrl });
    return this;
  }

  public addMember(tenantId: string, person: InMemoryPerson, role: Role, joinedAt = "2026-11-01T00:00:00.000Z"): this {
    this.people.set(person.userId, person);
    this.memberships.set(`${tenantId}:${person.userId}`, { role, status: "active", joinedAt });
    return this;
  }

  public membership(tenantId: string, userId: string): MembershipState | undefined {
    return this.memberships.get(`${tenantId}:${userId}`);
  }

  public readonly members: TeamRepository = {
    listMembers: async (tenantId) => this.activeOf(tenantId),
    findMember: async (tenantId, userId) => this.activeOf(tenantId).find((member) => member.userId === userId) ?? null,
    hasMemberWithEmail: async (tenantId, email) => this.activeOf(tenantId).some((member) => member.email === email),
    changeRole: async (tenantId, userId, role) => this.changeOwnerSafely(tenantId, userId, role === "tenant_owner", (state) => (state.role = role)) as ChangeRoleOutcome,
    removeMember: async (tenantId, userId) => this.changeOwnerSafely(tenantId, userId, false, (state) => (state.status = "revoked")) as RemoveMemberOutcome
  };

  public readonly invitations: InvitationRepository = {
    listPending: async (tenantId) =>
      [...this.invitationsById.values()]
        .filter((invitation) => invitation.tenantId === tenantId && invitation.status === "pending")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((invitation): InvitationWithInviter => ({ invitation, invitedByName: this.people.get(invitation.invitedBy)?.displayName ?? null })),
    countLivePending: async (tenantId, now) =>
      [...this.invitationsById.values()].filter((i) => i.tenantId === tenantId && i.status === "pending" && new Date(i.expiresAt) > now).length,
    findById: async (tenantId, id) => {
      const invitation = this.invitationsById.get(id);
      return invitation && invitation.tenantId === tenantId ? invitation : null;
    },
    findPendingByEmail: async (tenantId, email) =>
      [...this.invitationsById.values()].find((i) => i.tenantId === tenantId && i.email === email && i.status === "pending") ?? null,
    findPreviewByTokenHash: async (tokenHash) => {
      const invitation = [...this.invitationsById.values()].find((i) => i.tokenHash === tokenHash);
      const company = invitation ? this.companies.get(invitation.tenantId) : undefined;
      if (!invitation || !company) return null;
      const record: InvitationPreviewRecord = {
        invitation,
        companyName: company.name,
        companyLogoUrl: company.logoUrl,
        inviterName: this.people.get(invitation.invitedBy)?.displayName ?? null
      };
      return record;
    },
    save: async (invitation) => {
      this.invitationsById.set(invitation.id, invitation);
    },
    accept: async (invitationId, userId, at) => this.accept(invitationId, userId, at)
  };

  private activeOf(tenantId: string): TeamMemberRecord[] {
    return [...this.memberships.entries()]
      .filter(([key, state]) => key.startsWith(`${tenantId}:`) && state.status === "active")
      .map(([key, state]) => {
        const userId = key.slice(tenantId.length + 1);
        const person = this.people.get(userId);
        return { userId, role: state.role, joinedAt: state.joinedAt, displayName: person?.displayName ?? null, email: person?.email ?? null, photoUrl: person?.photoUrl ?? null };
      })
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  private changeOwnerSafely(tenantId: string, userId: string, keepsOwner: boolean, apply: (state: MembershipState) => void): string {
    const state = this.membership(tenantId, userId);
    if (!state || state.status !== "active") return "not_found";
    const owners = this.activeOf(tenantId).filter((member) => member.role === "tenant_owner").length;
    if (state.role === "tenant_owner" && !keepsOwner && owners <= 1) return "last_owner";
    apply(state);
    return keepsOwner || state.status === "active" ? "changed" : "removed";
  }

  private accept(invitationId: string, userId: string, at: Date): AcceptOutcome {
    const invitation = this.invitationsById.get(invitationId);
    if (!invitation || invitation.status !== "pending" || new Date(invitation.expiresAt) <= at) return "not_pending";
    this.invitationsById.set(invitationId, { ...invitation, status: "accepted", acceptedBy: userId, acceptedAt: at.toISOString() });
    const current = this.membership(invitation.tenantId, userId);
    if (current?.status === "active") return "already_member";
    this.memberships.set(`${invitation.tenantId}:${userId}`, { role: invitation.role as TeamRole, status: "active", joinedAt: at.toISOString() });
    return "joined";
  }
}
