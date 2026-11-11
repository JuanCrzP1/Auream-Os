import "./campaign-funnel.css";
import type { CampaignDetailResponse, CampaignStats } from "@contracts/GroupContracts";
import { formatMoney } from "@shared/format/formatMoney";
import { count, money, percent } from "../groupsFormat";

/** Del clic a la venta, en plata primero, y los últimos 14 días de entradas y salidas. */
export function CampaignFunnel({ stats, daily }: { readonly stats: CampaignStats; readonly daily: CampaignDetailResponse["daily"] }) {
  const revenue = money(stats.revenue);
  const main = stats.revenue[0];
  const perMember = main && stats.members > 0 ? formatMoney(Math.round(main.amount / stats.members), main.currency) : null;
  const stayed = Math.max(0, stats.joined - stats.left);
  const steps = [
    { label: "Clics al enlace", value: stats.clicks, note: "de anuncios, bio e historias", width: 100 },
    { label: "Entraron", value: stats.joined, note: stats.clicks > 0 ? `${percent(stats.joined, stats.clicks)} de los clics` : "a los grupos", width: stats.clicks ? (stats.joined / stats.clicks) * 100 : 0 },
    { label: "Se quedaron", value: stayed, note: `${percent(stayed, stats.joined)} · ${count(stats.left)} salieron`, width: stats.clicks ? (stayed / stats.clicks) * 100 : 0 },
    { label: "Compraron", value: stats.buyers, note: `${percent(stats.buyers, stats.members)} de los miembros`, width: stats.clicks ? (stats.buyers / stats.clicks) * 100 : 0, accent: true }
  ];
  const peak = Math.max(1, ...daily.map((day) => Math.max(day.joined, day.left)));
  return (
    <section className="gr-funnel" aria-label="Del clic a la venta">
      <div className="gr-funnel__head">
        <div>
          <span className="gr-funnel__label">Del clic a la venta</span>
          <strong className="gr-funnel__money">{revenue.main}</strong>
          <span className="gr-funnel__sentence">
            {stats.buyers === 0 ? "Cuenta la venta de quien estaba en un grupo de la campaña cuando compró." : `${count(stats.buyers)} ${stats.buyers === 1 ? "compró" : "compraron"}${perMember ? ` · cada miembro dejó ${perMember}` : ""}`}
            {revenue.others > 0 ? ` · más ${revenue.others} moneda${revenue.others > 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <div className="gr-funnel__days" aria-label="Entradas y salidas, últimos 14 días">
          {daily.map((day) => (
            <span key={day.day} className="gr-funnel__day" title={`${day.day}: +${day.joined} −${day.left} · ${day.clicks} clics`}>
              <i style={{ height: `${Math.round((day.joined / peak) * 100)}%` }} />
              <b style={{ height: `${Math.round((day.left / peak) * 100)}%` }} />
            </span>
          ))}
        </div>
      </div>
      <div className="gr-funnel__steps">
        {steps.map((step) => (
          <div key={step.label} className={`gr-funnel__step${step.accent ? " gr-funnel__step--accent" : ""}`}>
            <span className="gr-funnel__step-label">{step.label}</span>
            <strong>{count(step.value)}</strong>
            <span className="gr-funnel__track"><span style={{ width: `${Math.max(step.value > 0 ? 3 : 0, Math.min(100, Math.round(step.width)))}%` }} /></span>
            <span className="gr-funnel__note">{step.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
