import "./team.css";
import { useState, type ReactNode } from "react";
import { useActiveTenantOptional } from "@shared/auth/tenant/ActiveTenantContext";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { TEAM_ROLE_INFO, type TeamRoleTone } from "@shared/team/teamRoles";
import { useTeam } from "../hooks/useTeam";
import { InvitationRow } from "./InvitationRow";
import { MemberRow } from "./MemberRow";
import { RolesGuide } from "./RolesGuide";
import { TeamDialogs, type TeamDialog } from "./TeamDialogs";
import { TeamIcons } from "./teamIcons";

/**
 * Configuración → Equipo: quién trabaja en la cuenta y con qué rol, las
 * invitaciones pendientes y qué puede hacer cada rol. Quien administra el
 * equipo invita, cambia roles y quita; el resto lo ve. El servidor decide
 * qué puede tocar cada uno (`assignableRoles` y `canManage`).
 */
export function TeamSettings() {
  const team = useTeam();
  const [dialog, setDialog] = useState<TeamDialog>(null);
  const tenant = useActiveTenantOptional();
  const companyName =
    (tenant?.state.status === "ready" ? tenant.state.tenants.find((entry) => entry.tenantId === tenant.activeTenantId)?.tenantName : undefined) ?? "nuestro equipo";

  if (team.status === "loading") return <div className="team__loading" aria-busy="true" aria-label="Cargando el equipo" />;
  if (team.status === "forbidden") return <StateCard icon={StateIcons.lock} title="Sin acceso al equipo" description="Tu rol no permite ver el equipo de esta cuenta." />;
  if (team.status === "error" || !team.team) {
    return (
      <StateCard
        role="alert"
        tone="warning"
        icon={StateIcons.offline}
        title="No pudimos cargar el equipo"
        description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos."
        actions={<RetryButton busy={false} onRetry={() => void team.refresh()} />}
      />
    );
  }

  const { members, invitations, myRole, assignableRoles } = team.team;
  const mine = TEAM_ROLE_INFO[myRole];

  return (
    <section className="team" aria-labelledby="team-title">
      <header className="team__head">
        <div>
          <h2 id="team-title" className="team__title">
            Equipo
          </h2>
          <p className="team__lead">Las personas que trabajan contigo en esta cuenta y lo que puede hacer cada una.</p>
        </div>
        {assignableRoles.length > 0 ? (
          <button type="button" className="ui-btn ui-btn--primary team__invite" onClick={() => setDialog({ kind: "invite" })}>
            {TeamIcons.plus}
            Invitar
          </button>
        ) : null}
      </header>

      <div className="team__stats">
        <Stat icon={TeamIcons.users} value={String(members.length)} label={members.length === 1 ? "miembro" : "miembros"} />
        <Stat icon={TeamIcons.mail} value={String(invitations.length)} label={invitations.length === 1 ? "invitación pendiente" : "invitaciones pendientes"} />
        <Stat icon={TeamIcons.shield} value={mine.label} label="tu rol" tone={mine.tone} />
      </div>

      <section className="team__section" aria-labelledby="team-members-title">
        <h3 id="team-members-title" className="team__section-title">
          Miembros
        </h3>
        <ul className="team__list">
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              assignableRoles={assignableRoles}
              onChangeRole={(role) => team.changeRole(member.userId, role)}
              onRemove={() => setDialog({ kind: "remove", member })}
            />
          ))}
        </ul>
      </section>

      {invitations.length > 0 ? (
        <section className="team__section" aria-labelledby="team-invitations-title">
          <h3 id="team-invitations-title" className="team__section-title">
            Invitaciones pendientes
          </h3>
          <ul className="team__list">
            {invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                onRenew={async () => setDialog({ kind: "link", link: await team.renew(invitation.id) })}
                onRevoke={() => setDialog({ kind: "revoke", invitation })}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <RolesGuide />
      <TeamDialogs dialog={dialog} team={team} assignableRoles={assignableRoles} companyName={companyName} onClose={() => setDialog(null)} />
    </section>
  );
}

function Stat({ icon, value, label, tone }: { readonly icon: ReactNode; readonly value: string; readonly label: string; readonly tone?: TeamRoleTone }) {
  return (
    <div className={`team-stat${tone ? ` team-stat--${tone}` : ""}`}>
      <span className="team-stat__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="team-stat__value">{value}</span>{" "}
      <span className="team-stat__label">{label}</span>
    </div>
  );
}
