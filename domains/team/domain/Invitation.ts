import type { InvitationPreviewStatus, TeamRole } from "../../../contracts/TeamContracts";

// ---------------------------------------------------------------------------
// Invitation — una invitación al equipo de una cuenta.
//
// Se entrega como un enlace secreto (`/invite/<token>`) que la persona abre;
// si no tiene cuenta, la crea ahí mismo. Reglas:
//   · el secreto se guarda solo como huella (SHA-256), como las claves del MCP;
//   · vence a los 7 días y sirve una sola vez;
//   · solo la acepta quien entra con el correo invitado;
//   · una sola pendiente por correo y cuenta (invitar de nuevo la renueva).
// ---------------------------------------------------------------------------

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Tope de invitaciones pendientes por cuenta: frena el abuso sin estorbar a nadie. */
export const MAX_PENDING_INVITATIONS = 50;

export type InvitationStatus = "pending" | "accepted" | "revoked";

export interface Invitation {
  readonly id: string;
  readonly tenantId: string;
  /** En minúsculas. */
  readonly email: string;
  readonly role: TeamRole;
  /** Huella SHA-256 (hex) del secreto del enlace. */
  readonly tokenHash: string;
  readonly status: InvitationStatus;
  readonly invitedBy: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly acceptedBy: string | null;
  readonly acceptedAt: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** El correo como se guarda (minúsculas, sin espacios), o `null` si no es un correo. */
export function normalizeInvitationEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export function invitationExpiry(now: Date): string {
  return new Date(now.getTime() + INVITATION_TTL_MS).toISOString();
}

export function isInvitationExpired(invitation: Pick<Invitation, "expiresAt">, now: Date): boolean {
  return new Date(invitation.expiresAt).getTime() <= now.getTime();
}

/** Lo que ve quien abre el enlace. */
export function invitationPreviewStatus(invitation: Pick<Invitation, "status" | "expiresAt">, now: Date): InvitationPreviewStatus {
  if (invitation.status !== "pending") return invitation.status;
  return isInvitationExpired(invitation, now) ? "expired" : "pending";
}

/** «ana.gomez@gmail.com» → «an***@gmail.com»: la persona lo reconoce sin que el enlace lo revele entero. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}***${email.slice(at)}`;
}
