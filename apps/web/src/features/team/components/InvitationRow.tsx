import "./team-role.css";
import "./invitation-row.css";
import { useState } from "react";
import type { TeamInvitationSummary } from "@contracts/TeamContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { TeamIcons } from "./teamIcons";

const DAY_MS = 24 * 60 * 60 * 1000;

/** «Vence hoy», «Vence mañana», «Vence en 6 días». */
function expiresIn(expiresAt: string, now = Date.now()): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - now) / DAY_MS);
  if (days <= 1) return days <= 0 ? "Vence hoy" : "Vence mañana";
  return `Vence en ${days} días`;
}

/**
 * Una invitación pendiente: el correo, su rol, quién invitó y cuándo vence.
 * «Enlace nuevo» genera otro (el anterior deja de servir; sirve también si
 * venció) y la equis la retira.
 */
export function InvitationRow({
  invitation,
  onRenew,
  onRevoke
}: {
  readonly invitation: TeamInvitationSummary;
  readonly onRenew: () => Promise<unknown>;
  readonly onRevoke: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = TEAM_ROLE_INFO[invitation.role];

  const renew = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRenew();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo generar el enlace. Inténtalo de nuevo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="invite-row">
      <span className="invite-row__icon" aria-hidden="true">
        {TeamIcons.mail}
      </span>
      <div className="invite-row__who">
        <span className="invite-row__email">{invitation.email}</span>
        <span className="invite-row__meta">
          {invitation.expired ? <span className="invite-row__expired">Venció</span> : expiresIn(invitation.expiresAt)}
          {invitation.invitedByName ? ` · Invitó ${invitation.invitedByName}` : ""}
        </span>
        {error ? (
          <span className="invite-row__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>

      <span className={`team-role team-role--${info.tone}`}>{info.label}</span>

      {invitation.canManage ? (
        <span className="invite-row__actions">
          <button type="button" className="ui-btn ui-btn--ghost invite-row__renew" onClick={() => void renew()} disabled={busy}>
            {busy ? "Generando…" : "Enlace nuevo"}
          </button>
          <button type="button" className="invite-row__remove" aria-label={`Retirar la invitación a ${invitation.email}`} title="Retirar invitación" onClick={onRevoke}>
            {TeamIcons.close}
          </button>
        </span>
      ) : (
        <span className="invite-row__space" aria-hidden="true" />
      )}
    </li>
  );
}
