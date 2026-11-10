import "./team-role.css";
import "./team-row.css";
import { useState } from "react";
import type { TeamMemberSummary, TeamRole } from "@contracts/TeamContracts";
import { AccountAvatar } from "@shared/account/AccountAvatar";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { MONTH_YEAR, lastSeenLabel } from "../teamTime";
import { MemberMenu } from "./MemberMenu";

/**
 * Un miembro en la tabla del equipo: foto o iniciales, nombre y correo, la
 * última vez que usó la app, desde cuándo está, su rol y el menú ⋯ (si quien
 * mira puede administrarlo; lo decide el servidor con `canManage`).
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
  const [error, setError] = useState<string | null>(null);
  const info = TEAM_ROLE_INFO[member.role];
  const name = member.displayName || member.email || "Sin nombre todavía";
  // Sin nombre, el correo hace de nombre y no se repite abajo.
  const contact = member.displayName || !member.email ? member.email ?? "Su correo aparece cuando vuelva a entrar" : null;
  const seen = member.isYou ? { text: "En línea", online: true } : lastSeenLabel(member.lastSeenAt);

  const change = (role: TeamRole) => {
    setError(null);
    onChangeRole(role).catch((e: unknown) => setError(apiErrorMessage(e, "No se pudo cambiar el rol. Inténtalo de nuevo.")));
  };

  return (
    <li className="team-row">
      <div className="team-row__person">
        <AccountAvatar name={name} imageUrl={member.photoUrl} size={40} />
        <div className="team-row__who">
          <span className="team-row__name">
            {name}
            {member.isYou ? <span className="team-row__you">Tú</span> : null}
          </span>
          {contact ? <span className="team-row__meta">{contact}</span> : null}
          {error ? (
            <span className="team-row__error" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      </div>
      <span className={`team-row__seen${seen.online ? " team-row__seen--online" : ""}`}>{seen.text}</span>
      <span className="team-row__since">{MONTH_YEAR.format(new Date(member.joinedAt))}</span>
      <span className={`team-role team-role--${info.tone}`}>{info.label}</span>
      {member.canManage ? (
        <MemberMenu name={name} role={member.role} assignableRoles={assignableRoles} onChangeRole={change} onRemove={onRemove} />
      ) : (
        <span aria-hidden="true" />
      )}
    </li>
  );
}
