import type { InvitationLinkResponse, TeamInvitationSummary } from "@contracts/TeamContracts";
import { InvitationRow } from "./InvitationRow";

/**
 * Invitaciones: las pendientes, con «Enlace nuevo» y retirar; o un aviso si no
 * hay (el botón de invitar vive arriba, junto a las pestañas).
 */
export function InvitationsTab({
  invitations,
  onRenew,
  onRevoke
}: {
  readonly invitations: ReadonlyArray<TeamInvitationSummary>;
  readonly onRenew: (invitation: TeamInvitationSummary) => Promise<InvitationLinkResponse>;
  readonly onRevoke: (invitation: TeamInvitationSummary) => void;
}) {
  if (invitations.length === 0) {
    return (
      <div className="team-empty">
        <p>No hay invitaciones pendientes. Cuando invites a alguien, su enlace queda aquí hasta que entre.</p>
      </div>
    );
  }

  return (
    <ul className="team-list" aria-label="Invitaciones pendientes">
      {invitations.map((invitation) => (
        <InvitationRow key={invitation.id} invitation={invitation} onRenew={() => onRenew(invitation)} onRevoke={() => onRevoke(invitation)} />
      ))}
    </ul>
  );
}
