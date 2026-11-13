import "./campaign-groups.css";
import { useState } from "react";
import type { GroupSummary } from "@contracts/GroupContracts";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { count, GROUP_STATE, money } from "../groupsFormat";
import { GroupActionsMenu, type GroupAction } from "./GroupActionsMenu";

interface Props {
  readonly groups: ReadonlyArray<GroupSummary>;
  readonly capacity: number;
  readonly open: boolean;
  /** Muestra el menú de cada grupo (`groups.manage`). */
  readonly canManage: boolean;
  readonly onSendTo: (groupId: string) => void;
  readonly onDetach: (groupId: string) => Promise<unknown>;
}

/** Los grupos de la campaña, llenándose, cada uno con lo que vendió y sus acciones; y el que se crea solo. */
export function CampaignGroups({ groups, capacity, open, canManage, onSendTo, onDetach }: Props) {
  const nextPosition = groups.reduce((max, group) => Math.max(max, group.position ?? 0), 0) + 1;
  const [detaching, setDetaching] = useState<GroupSummary | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const act = (group: GroupSummary, action: GroupAction) => {
    if (action === "send") onSendTo(group.id);
    if (action === "detach") setDetaching(group);
    if (action === "copy" && group.inviteLink) {
      void navigator.clipboard?.writeText(group.inviteLink).then(() => setCopied(group.id)).catch(() => setCopied(null));
    }
  };

  return (
    <section className="gr-groups" aria-label="Los grupos">
      <h2>Los grupos</h2>
      <div className="gr-groups__grid">
        {groups.map((group) => {
          const state = GROUP_STATE[group.state];
          const fill = Math.min(100, Math.round((group.members / capacity) * 100));
          return (
            <article key={group.id} className="gr-groups__card">
              <span className="gr-groups__top">
                <strong className="gr-groups__number">#{group.position ?? "–"}</strong>
                <span className="gr-groups__badges">
                  <span className={`gr-badge gr-badge--${state.tone}`}>{state.label}</span>
                  {canManage ? <GroupActionsMenu group={group} onAction={(action) => act(group, action)} /> : null}
                </span>
              </span>
              <span className="gr-groups__name" title={group.name}>{group.name}</span>
              <span className="ui-muted gr-groups__small">{group.connectionName}{group.isAdmin ? "" : " · ya no eres administrador"}</span>
              <span className="gr-groups__bar" aria-label={`${fill} % del cupo`}><span className={group.state === "full" ? "gr-groups__full" : undefined} style={{ width: `${fill}%` }} /></span>
              <span className="gr-groups__line"><span>{count(group.members)} miembros</span><strong>{group.buyers > 0 ? money(group.revenue).main : "—"}</strong></span>
              <span className="ui-muted gr-groups__small">+{count(group.joined)} entraron · {count(group.left)} salieron</span>
              {copied === group.id ? <span className="gr-groups__copied" role="status">Enlace del grupo copiado</span> : null}
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
      {detaching ? (
        <ConfirmDialog
          title={`¿Sacar «${detaching.name}» de la campaña?`}
          message="El grupo sigue en WhatsApp con sus miembros, pero el enlace de la campaña ya no llevará gente a él y no contará en sus números. Puedes volver a sumarlo desde «Mis grupos»."
          confirmLabel="Sacar de la campaña"
          busyLabel="Sacando…"
          onConfirm={() => onDetach(detaching.id)}
          onClose={() => setDetaching(null)}
        />
      ) : null}
    </section>
  );
}
