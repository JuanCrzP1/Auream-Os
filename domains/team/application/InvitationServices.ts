import type { AcceptInvitationResponse, InvitationPreviewResponse } from "../../../contracts/TeamContracts";
import { AccessError } from "../../../platform/authorization/domain/AccessError";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { invitationPreviewStatus, maskEmail } from "../domain/Invitation";
import type { InvitationPreviewRecord, InvitationRepository } from "./InvitationRepository";
import { hashInvitationToken, isWellFormedInvitationToken } from "./InvitationToken";

// ---------------------------------------------------------------------------
// La invitación vista por quien la recibe: abrir el enlace (sin sesión) y
// aceptarla (con sesión, sin cuenta elegida: es justo como entra a una).
//
// Aceptar exige el secreto del enlace Y entrar con el correo invitado: un
// enlace reenviado por error no le sirve a otra persona.
// ---------------------------------------------------------------------------

/** Quien acepta: su usuario y su correo, ambos del token firmado por Neon Auth. */
export interface InvitationAcceptor {
  readonly userId: string;
  readonly email?: string;
}

const NOT_FOUND = "Esta invitación no existe. Revisa el enlace o pide uno nuevo a quien te invitó.";

export class InvitationServices {
  public constructor(
    private readonly invitations: InvitationRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async preview(token: string): Promise<InvitationPreviewResponse> {
    const { invitation, companyName, companyLogoUrl, inviterName } = await this.find(token);
    return {
      status: invitationPreviewStatus(invitation, this.now()),
      companyName,
      companyLogoUrl,
      inviterName,
      role: invitation.role,
      emailHint: maskEmail(invitation.email),
      expiresAt: invitation.expiresAt
    };
  }

  public async accept(token: string, acceptor: InvitationAcceptor): Promise<AcceptInvitationResponse> {
    const { invitation, companyName } = await this.find(token);
    const joinedAnswer = (joined: boolean): AcceptInvitationResponse => ({ tenantId: invitation.tenantId, tenantName: companyName, role: invitation.role, joined });

    switch (invitationPreviewStatus(invitation, this.now())) {
      case "accepted":
        // Volver a tocar «Unirme» (otra pestaña, reintento) no es un error.
        if (invitation.acceptedBy === acceptor.userId) return joinedAnswer(false);
        throw new ConflictError("Esta invitación ya se usó. Pide un enlace nuevo a quien te invitó.");
      case "revoked":
        throw new ConflictError("Esta invitación fue cancelada. Pide un enlace nuevo a quien te invitó.");
      case "expired":
        throw new ConflictError("Esta invitación venció. Pide un enlace nuevo a quien te invitó.");
      case "pending":
        break;
    }

    if (!acceptor.email) throw new AccessError("No pudimos confirmar tu correo. Cierra sesión y vuelve a entrar.");
    if (acceptor.email !== invitation.email) {
      throw new AccessError(`Esta invitación es para ${maskEmail(invitation.email)}. Entra con ese correo para aceptarla.`);
    }

    const outcome = await this.invitations.accept(invitation.id, acceptor.userId, this.now());
    if (outcome === "not_pending") throw new ConflictError("Esta invitación ya no está disponible. Pide un enlace nuevo a quien te invitó.");
    return joinedAnswer(outcome === "joined");
  }

  private async find(token: string): Promise<InvitationPreviewRecord> {
    const record = isWellFormedInvitationToken(token) ? await this.invitations.findPreviewByTokenHash(hashInvitationToken(token)) : null;
    if (!record) throw new NotFoundError(NOT_FOUND);
    return record;
  }
}
