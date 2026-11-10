import type { Invitation } from "../domain/Invitation";

// ---------------------------------------------------------------------------
// InvitationRepository — puerto. Implementación SQL:
// `infrastructure/persistence/sql/SqlInvitationRepository.ts`.
// ---------------------------------------------------------------------------

export interface InvitationWithInviter {
  readonly invitation: Invitation;
  readonly invitedByName: string | null;
}

/** Lo que muestra la página del enlace: la invitación, su cuenta y quién invitó. */
export interface InvitationPreviewRecord {
  readonly invitation: Invitation;
  readonly companyName: string;
  readonly companyLogoUrl: string | null;
  readonly inviterName: string | null;
}

export type AcceptOutcome = "joined" | "already_member" | "not_pending";

export interface InvitationRepository {
  /** Pendientes de la cuenta (también las vencidas), de la más nueva a la más vieja. */
  listPending(tenantId: string): Promise<ReadonlyArray<InvitationWithInviter>>;
  /** Pendientes que aún no vencen (para el tope por cuenta). */
  countLivePending(tenantId: string, now: Date): Promise<number>;
  findById(tenantId: string, id: string): Promise<Invitation | null>;
  findPendingByEmail(tenantId: string, email: string): Promise<Invitation | null>;
  /** Por la huella del secreto del enlace; `null` si no existe o su cuenta no está activa. */
  findPreviewByTokenHash(tokenHash: string): Promise<InvitationPreviewRecord | null>;
  /** Crea o reemplaza (renovar, cancelar). */
  save(invitation: Invitation): Promise<void>;
  /**
   * Acepta, todo o nada: marca la invitación si sigue pendiente y sin vencer,
   * y crea o reactiva la membresía con su rol. Si la persona ya era miembro
   * activo, conserva su rol (`already_member`).
   */
  accept(invitationId: string, userId: string, at: Date): Promise<AcceptOutcome>;
}
