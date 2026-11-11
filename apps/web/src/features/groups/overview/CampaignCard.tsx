import "./campaign-card.css";
import type { CampaignSummary } from "@contracts/GroupContracts";
import { count, money, percent } from "../groupsFormat";

/** Una campaña: su enlace, sus grupos llenándose y lo que vendió. */
export function CampaignCard({ campaign, onOpen }: { readonly campaign: CampaignSummary; readonly onOpen: (id: string) => void }) {
  const { stats } = campaign;
  const stayed = Math.max(0, stats.joined - stats.left);
  const status = campaign.status === "closed" ? { label: "Enlace apagado", tone: "soon" } : campaign.current ? { label: "Llenando", tone: "live" } : { label: "Abriendo grupo", tone: "muted" };
  return (
    <button type="button" className="gr-card" onClick={() => onOpen(campaign.id)} aria-label={`Abrir ${campaign.name}`}>
      <span className="gr-card__top">
        <span className="gr-card__name">
          <strong>{campaign.name}</strong>
          <span>{campaign.link.replace(/^https?:\/\//, "")}</span>
        </span>
        <span className={`gr-badge gr-badge--${status.tone}`}>{status.label}</span>
      </span>
      <span className="gr-card__fill">
        <span className="gr-card__fill-text">
          <span>{campaign.groups.length} {campaign.groups.length === 1 ? "grupo" : "grupos"}{campaign.status === "active" ? " · el siguiente se crea solo" : ""}</span>
          <span>{campaign.current ? `${count(campaign.current.free)} cupos en ${campaign.current.name.split(" ").pop()}` : ""}</span>
        </span>
        <span className="gr-card__bars" aria-hidden="true">
          {(campaign.groups.length ? campaign.groups : [{ id: "none", members: 0 }]).map((group) => (
            <span key={group.id} className="gr-card__bar">
              <span style={{ width: `${Math.min(100, Math.round((group.members / campaign.capacity) * 100))}%` }} className={group.members >= campaign.capacity ? "gr-card__bar-full" : undefined} />
            </span>
          ))}
        </span>
      </span>
      <span className="gr-card__numbers">
        <span><strong>{count(stats.members)}</strong><small>miembros</small></span>
        <span><strong>{stats.joined > 0 ? percent(stayed, stats.joined) : "—"}</strong><small>se quedaron</small></span>
        <span className="gr-card__money"><strong>{money(stats.revenue).main}</strong><small>vendido</small></span>
      </span>
    </button>
  );
}
