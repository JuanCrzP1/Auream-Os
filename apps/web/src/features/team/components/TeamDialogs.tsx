import { useId } from "react";
import type { InvitationLinkResponse, TeamInvitationSummary, TeamMemberSummary, TeamRole } from "@contracts/TeamContracts";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import type { TeamState } from "../hooks/useTeam";
import { InviteDialog } from "./InviteDialog";
import { InviteLinkPanel } from "./InviteLinkPanel";

/** El diálogo abierto en Equipo, si hay uno. */
export type TeamDialog =
  | { readonly kind: "invite" }
  | { readonly kind: "link"; readonly link: InvitationLinkResponse }
  | { readonly kind: "remove"; readonly member: TeamMemberSummary }
  | { readonly kind: "revoke"; readonly invitation: TeamInvitationSummary }
  | null;

/** Los diálogos de Equipo: invitar, el enlace renovado, quitar a alguien y retirar una invitación. */
export function TeamDialogs({
  dialog,
  team,
  assignableRoles,
  companyName,
  onClose
}: {
  readonly dialog: TeamDialog;
  readonly team: TeamState;
  readonly assignableRoles: ReadonlyArray<TeamRole>;
  readonly companyName: string;
  readonly onClose: () => void;
}) {
  if (dialog === null) return null;
  if (dialog.kind === "invite") return <InviteDialog assignableRoles={assignableRoles} companyName={companyName} onInvite={team.invite} onClose={onClose} />;
  if (dialog.kind === "link") return <RenewedLinkDialog link={dialog.link} companyName={companyName} onClose={onClose} />;

  if (dialog.kind === "remove") {
    const name = dialog.member.displayName || dialog.member.email || "esta persona";
    return (
      <ConfirmDialog
        title={`¿Quitar a ${name} del equipo?`}
        message="Pierde el acceso a esta cuenta al instante. Sus conversaciones y lo que hizo se conservan; para que vuelva, la invitas de nuevo."
        confirmLabel="Quitar del equipo"
        onConfirm={() => team.remove(dialog.member.userId)}
        onClose={onClose}
      />
    );
  }

  return (
    <ConfirmDialog
      title={`¿Retirar la invitación a ${dialog.invitation.email}?`}
      message="El enlace deja de servir. Puedes invitar a esa persona otra vez cuando quieras."
      confirmLabel="Retirar invitación"
      onConfirm={() => team.revoke(dialog.invitation.id)}
      onClose={onClose}
    />
  );
}

function RenewedLinkDialog({ link, companyName, onClose }: { readonly link: InvitationLinkResponse; readonly companyName: string; readonly onClose: () => void }) {
  const titleId = useId();
  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="ui-dialog" onClick={(event) => event.stopPropagation()}>
        <InviteLinkPanel titleId={titleId} link={link} companyName={companyName} renewed onDone={onClose} />
      </div>
    </div>
  );
}
