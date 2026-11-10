import "./activity-tab.css";
import { useEffect, useState, type ReactNode } from "react";
import type { TeamActivityItem } from "@contracts/TeamContracts";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { teamApi } from "../services/teamApi";
import { activityTime } from "../teamTime";
import { TeamIcons } from "./teamIcons";

type Loaded = { readonly kind: "loading" | "error" } | { readonly kind: "ready"; readonly entries: ReadonlyArray<TeamActivityItem> };

const SOMEONE = "Alguien";

/** La frase de cada cosa que pasó, con quién y a quién en negrita. */
function sentence(entry: TeamActivityItem): ReactNode {
  const actor = <strong>{entry.actorName ?? SOMEONE}</strong>;
  const target = <strong>{entry.targetName ?? "alguien"}</strong>;
  const role = entry.role ? TEAM_ROLE_INFO[entry.role].label : "";
  switch (entry.action) {
    case "invited":
      return <>{actor} invitó a {target} como {role}</>;
    case "invitation_renewed":
      return <>{actor} generó un enlace nuevo para {target}</>;
    case "invitation_revoked":
      return <>{actor} retiró la invitación a {target}</>;
    case "joined":
      return <>{actor} entró al equipo como {role}</>;
    case "role_changed":
      return <>{actor} cambió a {target} a {role}</>;
    case "removed":
      return <>{actor} quitó a {target} del equipo</>;
  }
}

const ICON: Readonly<Record<TeamActivityItem["action"], ReactNode>> = {
  invited: TeamIcons.mail,
  invitation_renewed: TeamIcons.link,
  invitation_revoked: TeamIcons.close,
  joined: TeamIcons.userPlus,
  role_changed: TeamIcons.swap,
  removed: TeamIcons.trash
};

/** Actividad: quién invitó, entró, cambió un rol o quitó a alguien, y cuándo. */
export function ActivityTab() {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    teamApi
      .activity()
      .then(({ entries }) => alive && setLoaded({ kind: "ready", entries }))
      .catch(() => alive && setLoaded({ kind: "error" }));
    return () => {
      alive = false;
    };
  }, []);

  if (loaded.kind !== "ready") {
    return loaded.kind === "loading" ? (
      <div className="activity-tab__loading" aria-busy="true" aria-label="Cargando la actividad" />
    ) : (
      <p className="activity-tab__empty">No pudimos cargar la actividad. Vuelve a intentarlo en unos segundos.</p>
    );
  }
  if (loaded.entries.length === 0) return <p className="activity-tab__empty">Todavía no hay actividad. Aquí verás quién invita, quién entra y quién cambia un rol.</p>;

  return (
    <ol className="activity-tab" aria-label="Actividad del equipo">
      {loaded.entries.map((entry) => (
        <li key={entry.id} className={`activity-item activity-item--${entry.action}`}>
          <span className="activity-item__icon" aria-hidden="true">
            {ICON[entry.action]}
          </span>
          <p className="activity-item__text">{sentence(entry)}</p>
          <time className="activity-item__time" dateTime={entry.at}>
            {activityTime(entry.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
