import "./team-role.css";
import "./team-row.css";
import { useState } from "react";
import type { TeamMemberSummary, TeamRole } from "@contracts/TeamContracts";
import { AccountAvatar } from "@shared/account/AccountAvatar";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { TeamIcons } from "./teamIcons";

const SINCE = new Intl.DateTimeFormat("es", { month: "short", year: "numeric" });

/**
 * Un miembro del equipo: foto o iniciales, nombre, correo, desde cuándo está
 * y su rol. Si quien mira puede administrarlo, el rol se cambia ahí mismo y
 * aparece «Quitar». El servidor decide `canManage` (nadie se toca a sí mismo,
 * un administrador no toca a los dueños).
 */
export function MemberRow({
  member,
  assignableRoles,
  onChangeRole,
  onRemove
}: {
  readonly member: TeamMemberSummary;
  readonly assignableRoles: ReadonlyArray<TeamRole>;
  readonly onChangeRole: (role: TeamRole) => Promise<unknown>;
  readonly onRemove: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = TEAM_ROLE_INFO[member.role];
  const name = member.displayName || member.email || "Sin nombre todavía";
  // Sin nombre, el correo hace de nombre y no se repite abajo.
  const contact = member.displayName || !member.email ? member.email ?? "Su correo aparece cuando vuelva a entrar" : null;
  const meta = [contact, `Desde ${SINCE.format(new Date(member.joinedAt))}`].filter(Boolean).join(" · ");

  const change = async (role: TeamRole) => {
    setBusy(true);
    setError(null);
    try {
      await onChangeRole(role);
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo cambiar el rol. Inténtalo de nuevo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="team-row">
      <AccountAvatar name={name} imageUrl={member.photoUrl} size={40} />
      <div className="team-row__who">
        <span className="team-row__name">
          {name}
          {member.isYou ? <span className="team-row__you">Tú</span> : null}
        </span>
        <span className="team-row__meta">{meta}</span>
        {error ? (
          <span className="team-row__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>

      {member.canManage ? (
        <span className={`team-role team-role--${info.tone} team-role--select`}>
          <select aria-label={`Rol de ${name}`} value={member.role} disabled={busy} onChange={(event) => void change(event.target.value as TeamRole)}>
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {TEAM_ROLE_INFO[role].label}
              </option>
            ))}
          </select>
        </span>
      ) : (
        <span className={`team-role team-role--${info.tone}`}>{info.label}</span>
      )}

      {member.canManage ? (
        <button type="button" className="team-row__icon team-row__icon--danger" aria-label={`Quitar a ${name} del equipo`} title="Quitar del equipo" onClick={onRemove}>
          {TeamIcons.trash}
        </button>
      ) : (
        <span className="team-row__icon-space" aria-hidden="true" />
      )}
    </li>
  );
}
