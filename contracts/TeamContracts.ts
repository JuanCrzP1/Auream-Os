import type { Role } from "../platform/authorization/contracts/Role";

// ---------------------------------------------------------------------------
// Contratos del equipo (Configuración → Equipo e invitaciones por enlace).
//
// Lo que cruza HTTP entre `apps/api` y `apps/web`. Las reglas (quién puede
// tocar a quién) viven en `domains/team/domain/TeamPolicy`; aquí solo la forma.
// ---------------------------------------------------------------------------

/**
 * Los roles de las PERSONAS del equipo, de mayor a menor. Los nombres que ve
 * el cliente los pone la web: Dueño, Administrador, Asesor y Solo lectura.
 * (`platform_admin`, `api_client` y `worker` no son roles de un equipo.)
 */
export type TeamRole = Extract<Role, "tenant_owner" | "tenant_admin" | "operator" | "viewer">;

export const TEAM_ROLES: ReadonlyArray<TeamRole> = ["tenant_owner", "tenant_admin", "operator", "viewer"];

export const isTeamRole = (value: unknown): value is TeamRole => TEAM_ROLES.some((role) => role === value);

export interface TeamMemberSummary {
  readonly userId: string;
  /** Nombre visible (Mi perfil); `null` si nunca lo puso. */
  readonly displayName: string | null;
  /** Correo de acceso; `null` si aún no ha entrado desde que existe Equipo. */
  readonly email: string | null;
  readonly photoUrl: string | null;
  readonly role: TeamRole;
  /** Desde cuándo está en la cuenta (ISO). */
  readonly joinedAt: string;
  /** Es quien pregunta. */
  readonly isYou: boolean;
  /** Si quien pregunta puede cambiarle el rol o quitarlo. */
  readonly canManage: boolean;
}

export interface TeamInvitationSummary {
  readonly id: string;
  readonly email: string;
  readonly role: TeamRole;
  readonly invitedByName: string | null;
  readonly createdAt: string;
  readonly expiresAt: string;
  /** Venció sin usarse: se puede renovar o cancelar. */
  readonly expired: boolean;
  /** Si quien pregunta puede renovarla o cancelarla. */
  readonly canManage: boolean;
}

/** `GET /team` */
export interface TeamResponse {
  readonly members: ReadonlyArray<TeamMemberSummary>;
  readonly invitations: ReadonlyArray<TeamInvitationSummary>;
  /** Tu rol en esta cuenta. */
  readonly myRole: TeamRole;
  /** Roles que puedes dar al invitar o al cambiar a alguien (vacío: no administras el equipo). */
  readonly assignableRoles: ReadonlyArray<TeamRole>;
}

/** `POST /team/invitations` */
export interface CreateInvitationRequest {
  readonly email: string;
  readonly role: TeamRole;
}

/**
 * La invitación recién creada o renovada, con su enlace. El secreto se
 * entrega UNA sola vez: el servidor guarda solo su huella.
 */
export interface InvitationLinkResponse {
  readonly invitation: TeamInvitationSummary;
  /** Va en el enlace `/invite/<token>`. */
  readonly token: string;
}

/** `PATCH /team/members/:userId` */
export interface ChangeMemberRoleRequest {
  readonly role: TeamRole;
}

export type InvitationPreviewStatus = "pending" | "expired" | "revoked" | "accepted";

/** `GET /invitations/:token` — lo que ve quien abre el enlace, sin sesión. */
export interface InvitationPreviewResponse {
  readonly status: InvitationPreviewStatus;
  readonly companyName: string;
  readonly companyLogoUrl: string | null;
  readonly inviterName: string | null;
  readonly role: TeamRole;
  /** El correo invitado, a medias («an***@gmail.com»). */
  readonly emailHint: string;
  readonly expiresAt: string;
}

/** `POST /me/invitations/:token/accept` */
export interface AcceptInvitationResponse {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: TeamRole;
  /** `false` si ya pertenecías a esa cuenta (no se cambió nada). */
  readonly joined: boolean;
}
