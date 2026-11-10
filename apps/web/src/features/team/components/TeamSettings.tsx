import "./team.css";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useActiveTenantOptional } from "@shared/auth/tenant/ActiveTenantContext";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { useTeam } from "../hooks/useTeam";
import { ActivityTab } from "./ActivityTab";
import { InvitationsTab } from "./InvitationsTab";
import { MembersTab } from "./MembersTab";
import { RolesTab } from "./RolesTab";
import { TeamDialogs, type TeamDialog } from "./TeamDialogs";
import { TeamIcons } from "./teamIcons";

type TeamTab = "members" | "invitations" | "roles" | "activity";
const TABS: ReadonlyArray<TeamTab> = ["members", "invitations", "roles", "activity"];
const isTab = (value: string | null): value is TeamTab => TABS.some((tab) => tab === value);

/**
 * Configuración → Equipo: Miembros (buscador, filtro, última vez y menú ⋯),
 * Invitaciones, Roles y Actividad. Quien administra el equipo invita, cambia
 * roles y quita; el resto lo ve. El servidor decide qué puede tocar cada uno
 * (`assignableRoles` y `canManage`). La pestaña viaja en la dirección (`?tab=`).
 */
export function TeamSettings() {
  const team = useTeam();
  const [dialog, setDialog] = useState<TeamDialog>(null);
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: TeamTab = isTab(requested) ? requested : "members";
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

  const view = team.team;
  const canInvite = view.assignableRoles.length > 0;
  // Solo en la cuenta: la tarjeta «Trabaja en equipo» ya trae su botón de invitar.
  const alone = view.members.length === 1 && view.invitations.length === 0;
  const invite = () => setDialog({ kind: "invite" });
  const labels: Readonly<Record<TeamTab, string>> = {
    members: `Miembros · ${view.members.length}`,
    invitations: `Invitaciones · ${view.invitations.length}`,
    roles: "Roles",
    activity: "Actividad"
  };

  return (
    <section className="team" aria-label="Equipo">
      <div className="team__bar">
        <PillTabs
          label="Secciones del equipo"
          tabs={[
            { id: "members", label: "Miembros", count: view.members.length },
            { id: "invitations", label: "Invitaciones", count: view.invitations.length },
            { id: "roles", label: "Roles" },
            { id: "activity", label: "Actividad" }
          ]}
          selected={tab}
          onSelect={(id) => setParams({ tab: id }, { replace: true })}
        />
        {canInvite && !(alone && tab === "members") ? (
          <button type="button" className="ui-btn ui-btn--primary team__invite" onClick={invite}>
            {TeamIcons.plus}
            Invitar personas
          </button>
        ) : null}
      </div>

      <div role="tabpanel" aria-label={labels[tab]}>
        {tab === "members" ? (
          <MembersTab
            view={view}
            onInvite={invite}
            onChangeRole={(userId, role) => team.changeRole(userId, role)}
            onRemove={(member) => setDialog({ kind: "remove", member })}
          />
        ) : null}
        {tab === "invitations" ? (
          <InvitationsTab
            invitations={view.invitations}
            onRenew={async (invitation) => {
              const link = await team.renew(invitation.id);
              setDialog({ kind: "link", link });
              return link;
            }}
            onRevoke={(invitation) => setDialog({ kind: "revoke", invitation })}
          />
        ) : null}
        {tab === "roles" ? <RolesTab /> : null}
        {tab === "activity" ? <ActivityTab /> : null}
      </div>

      <TeamDialogs dialog={dialog} team={team} assignableRoles={view.assignableRoles} companyName={companyName} onClose={() => setDialog(null)} />
    </section>
  );
}
