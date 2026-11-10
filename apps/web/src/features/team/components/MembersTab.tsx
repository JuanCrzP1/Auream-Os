import "./members-tab.css";
import { useState } from "react";
import type { TeamMemberSummary, TeamResponse, TeamRole } from "@contracts/TeamContracts";
import { TEAM_ROLES } from "@contracts/TeamContracts";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { MemberRow } from "./MemberRow";
import { TeamIcons } from "./teamIcons";

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Miembros: buscador, filtro por rol y la tabla. Si estás solo en la cuenta,
 * arriba una tarjeta que invita a sumar al equipo (en vez de una lista de uno).
 */
export function MembersTab({
  view,
  onInvite,
  onChangeRole,
  onRemove
}: {
  readonly view: TeamResponse;
  readonly onInvite: () => void;
  readonly onChangeRole: (userId: string, role: TeamRole) => Promise<unknown>;
  readonly onRemove: (member: TeamMemberSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<TeamRole | "all">("all");
  const alone = view.members.length === 1 && view.invitations.length === 0;
  const canInvite = view.assignableRoles.length > 0;
  const needle = normalize(query.trim());
  const shown = view.members.filter(
    (member) => (role === "all" || member.role === role) && (!needle || normalize(`${member.displayName ?? ""} ${member.email ?? ""}`).includes(needle))
  );

  return (
    <div className="members-tab">
      {alone && canInvite ? (
        <section className="team-hero" aria-labelledby="team-hero-title">
          <span className="team-hero__icon" aria-hidden="true">
            {TeamIcons.users}
          </span>
          <div className="team-hero__copy">
            <h2 id="team-hero-title" className="team-hero__title">
              Trabaja en equipo
            </h2>
            <p className="team-hero__text">Invita a tus asesores para que atiendan los chats contigo. Cada uno entra con su propia cuenta y su rol.</p>
            <ul className="team-hero__perks">
              <li>Cada uno con su rol</li>
              <li>Ves quién hizo qué</li>
              <li>Sin compartir contraseñas</li>
            </ul>
          </div>
          <button type="button" className="ui-btn ui-btn--primary team-hero__button" onClick={onInvite}>
            {TeamIcons.plus}
            Invitar personas
          </button>
        </section>
      ) : null}

      <div className="members-tab__filters">
        <label className="members-tab__search">
          <span className="members-tab__search-icon" aria-hidden="true">
            {TeamIcons.search}
          </span>
          <input type="search" aria-label="Buscar persona" placeholder="Buscar persona…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <select className="members-tab__role" aria-label="Filtrar por rol" value={role} onChange={(event) => setRole(event.target.value as TeamRole | "all")}>
          <option value="all">Todos los roles</option>
          {TEAM_ROLES.map((option) => (
            <option key={option} value={option}>
              {TEAM_ROLE_INFO[option].label}
            </option>
          ))}
        </select>
      </div>

      <div className="team-table">
        <div className="team-table__head" aria-hidden="true">
          <span>Persona</span>
          <span>Última vez</span>
          <span>Desde</span>
          <span>Rol</span>
          <span />
        </div>
        <ul className="team-table__rows" aria-label="Miembros">
          {shown.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              assignableRoles={view.assignableRoles}
              onChangeRole={(next) => onChangeRole(member.userId, next)}
              onRemove={() => onRemove(member)}
            />
          ))}
        </ul>
        {shown.length === 0 ? <p className="members-tab__none">Nadie coincide con la búsqueda.</p> : null}
      </div>
    </div>
  );
}
