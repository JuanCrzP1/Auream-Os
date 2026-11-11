import "./campaign-groups.css";
import type { GroupSummary } from "@contracts/GroupContracts";
import { count, GROUP_STATE, money } from "../groupsFormat";

/** Los grupos de la campaña, llenándose, cada uno con lo que vendió; y el que se crea solo. */
export function CampaignGroups({ groups, capacity, open }: { readonly groups: ReadonlyArray<GroupSummary>; readonly capacity: number; readonly open: boolean }) {
  const nextPosition = groups.reduce((max, group) => Math.max(max, group.position ?? 0), 0) + 1;
  return (
    <section className="gr-groups" aria-label="Los grupos">
      <h2>Los grupos</h2>
      <div className="gr-groups__grid">
        {groups.map((group) => {
          const state = GROUP_STATE[group.state];
          const fill = Math.min(100, Math.round((group.members / capacity) * 100));
          return (
            <article key={group.id} className="gr-groups__card">
              <span className="gr-groups__top"><strong className="gr-groups__number">#{group.position ?? "–"}</strong><span className={`gr-badge gr-badge--${state.tone}`}>{state.label}</span></span>
              <span className="gr-groups__name" title={group.name}>{group.name}</span>
              <span className="ui-muted gr-groups__small">{group.connectionName}{group.isAdmin ? "" : " · ya no eres administrador"}</span>
              <span className="gr-groups__bar" aria-label={`${fill} % del cupo`}><span className={group.state === "full" ? "gr-groups__full" : undefined} style={{ width: `${fill}%` }} /></span>
              <span className="gr-groups__line"><span>{count(group.members)} miembros</span><strong>{group.buyers > 0 ? money(group.revenue).main : "—"}</strong></span>
              <span className="ui-muted gr-groups__small">+{count(group.joined)} entraron · {count(group.left)} salieron</span>
            </article>
          );
        })}
        {open ? (
          <article className="gr-groups__card gr-groups__card--next">
            <span className="gr-groups__top"><strong className="gr-groups__number">#{nextPosition}</strong><span className="gr-badge gr-badge--muted">Se crea solo</span></span>
            <span className="ui-muted gr-groups__small">Al llegar el anterior al 90 % del cupo, con el mismo nombre, foto y reglas.</span>
          </article>
        ) : null}
      </div>
    </section>
  );
}
