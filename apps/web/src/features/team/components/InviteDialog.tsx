import "./team-role.css";
import "./invite-dialog.css";
import { useId, useState, type FormEvent } from "react";
import type { InvitationLinkResponse, TeamRole } from "@contracts/TeamContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { EmailChipsInput, isEmail } from "./EmailChipsInput";
import { InviteLinkPanel } from "./InviteLinkPanel";
import { InviteResults, type InviteOutcome } from "./InviteResults";
import { TeamIcons } from "./teamIcons";

/** Rol que viene marcado: Asesor si se puede dar (el más común), si no el más bajo permitido. */
const initialRole = (roles: ReadonlyArray<TeamRole>): TeamRole => (roles.includes("operator") ? "operator" : roles[roles.length - 1]!);

/**
 * Invitar: uno o varios correos (como chips) con el mismo rol (solo los que
 * quien invita puede dar), y después el enlace de cada uno. La persona no
 * necesita tener cuenta: la crea al abrir el enlace, con ese correo.
 */
export function InviteDialog({
  assignableRoles,
  companyName,
  onInvite,
  onClose
}: {
  readonly assignableRoles: ReadonlyArray<TeamRole>;
  readonly companyName: string;
  readonly onInvite: (email: string, role: TeamRole) => Promise<InvitationLinkResponse>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const emailsId = useId();
  const [emails, setEmails] = useState<ReadonlyArray<string>>([]);
  const [role, setRole] = useState<TeamRole>(initialRole(assignableRoles));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<ReadonlyArray<InviteOutcome> | null>(null);
  const invalid = emails.filter((email) => !isEmail(email));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (emails.length === 0) return setError("Escribe al menos un correo.");
    if (invalid.length > 0) return setError(`Revisa ${invalid.length === 1 ? "este correo" : "estos correos"}: ${invalid.join(", ")}.`);
    setBusy(true);
    setError(null);
    const results: InviteOutcome[] = [];
    for (const email of emails) {
      try {
        results.push({ email, link: await onInvite(email, role) });
      } catch (e) {
        results.push({ email, error: apiErrorMessage(e, "No se pudo invitar.") });
      }
    }
    setBusy(false);
    setOutcomes(results);
  };

  const single = outcomes?.length === 1 && outcomes[0]?.link ? outcomes[0].link : null;

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog invite-dialog" onClick={(event) => event.stopPropagation()}>
        {single ? (
          <InviteLinkPanel titleId={titleId} link={single} companyName={companyName} onDone={onClose} />
        ) : outcomes ? (
          <InviteResults titleId={titleId} outcomes={outcomes} companyName={companyName} onDone={onClose} />
        ) : (
          <form className="invite-dialog__form" onSubmit={(event) => void submit(event)}>
            <div className="invite-dialog__head">
              <span className="invite-dialog__badge" aria-hidden="true">
                {TeamIcons.userPlus}
              </span>
              <div>
                <h2 id={titleId}>Invitar personas</h2>
                <p className="ui-muted">Les das un enlace. Si no tienen cuenta, la crean ahí mismo con su correo.</p>
              </div>
            </div>

            <div className="ui-field">
              <label htmlFor={emailsId}>Correos (uno o varios)</label>
              <EmailChipsInput id={emailsId} emails={emails} onChange={(next) => {
                  setEmails(next);
                  setError(null);
                }}
              />
            </div>

            <fieldset className="invite-dialog__roles">
              <legend>Rol</legend>
              {assignableRoles.map((option) => (
                <label key={option} className="invite-role">
                  <input type="radio" name="team-role" value={option} checked={role === option} onChange={() => setRole(option)} />
                  <span className="invite-role__body">
                    <span className={`team-role team-role--${TEAM_ROLE_INFO[option].tone}`}>{TEAM_ROLE_INFO[option].label}</span>
                    <span className="invite-role__text">{TEAM_ROLE_INFO[option].description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {error ? (
              <p className="ui-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="ui-dialog__footer">
              <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || emails.length === 0}>
                {busy ? "Creando…" : emails.length > 1 ? `Invitar a ${emails.length}` : "Crear invitación"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
