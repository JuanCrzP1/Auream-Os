import "./team-role.css";
import "./invite-dialog.css";
import { useId, useState, type FormEvent } from "react";
import type { InvitationLinkResponse, TeamRole } from "@contracts/TeamContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { InviteLinkPanel } from "./InviteLinkPanel";
import { TeamIcons } from "./teamIcons";

/** Rol que viene marcado: Asesor si se puede dar (el más común), si no el más bajo permitido. */
const initialRole = (roles: ReadonlyArray<TeamRole>): TeamRole => (roles.includes("operator") ? "operator" : roles[roles.length - 1]!);

/**
 * Invitar a alguien: correo y rol (solo los que quien invita puede dar), y
 * después el enlace para mandárselo. La persona no necesita tener cuenta: la
 * crea al abrir el enlace, con ese correo.
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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>(initialRole(assignableRoles));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<InvitationLinkResponse | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setLink(await onInvite(email.trim(), role));
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo crear la invitación. Inténtalo de nuevo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog invite-dialog" onClick={(event) => event.stopPropagation()}>
        {link ? (
          <InviteLinkPanel titleId={titleId} link={link} companyName={companyName} onDone={onClose} />
        ) : (
          <form className="invite-dialog__form" onSubmit={(event) => void submit(event)}>
            <div className="invite-dialog__head">
              <span className="invite-dialog__badge" aria-hidden="true">
                {TeamIcons.userPlus}
              </span>
              <div>
                <h2 id={titleId}>Invitar a tu equipo</h2>
                <p className="ui-muted">Le das un enlace. Si no tiene cuenta, la crea ahí mismo con este correo.</p>
              </div>
            </div>

            <label className="ui-field">
              <span>Correo de la persona</span>
              <input className="ui-input" type="email" autoFocus required maxLength={254} value={email} placeholder="ana@tuempresa.com" onChange={(event) => setEmail(event.target.value)} />
            </label>

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
              <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || email.trim() === ""}>
                {busy ? "Creando…" : "Crear invitación"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
