import "./groups-hero.css";
import type { CampaignStats } from "@contracts/GroupContracts";
import { count, money, percent } from "../groupsFormat";

/** Este mes: la plata que dejaron los miembros de tus grupos y del clic a la compra. */
export function GroupsHero({ month }: { readonly month: CampaignStats }) {
  const revenue = money(month.revenue);
  const stayed = Math.max(0, month.joined - month.left);
  return (
    <section className="gr-hero" aria-label="Grupos este mes">
      <div className="gr-hero__lead">
        <span className="gr-hero__label">Vendido a miembros de tus grupos · este mes</span>
        <strong className="gr-hero__money">{revenue.main}</strong>
        <span className="gr-hero__sentence">
          {month.buyers === 0 ? "Cuando alguien que está en un grupo de tus campañas compre, aparece aquí." : `${count(month.buyers)} ${month.buyers === 1 ? "persona compró" : "personas compraron"} mientras estaban en un grupo de tus campañas.`}
          {revenue.others > 0 ? ` Más ${revenue.others} ${revenue.others === 1 ? "moneda" : "monedas"}.` : ""}
        </span>
      </div>
      <div className="gr-hero__grid">
        <Card label="Clics al enlace" value={count(month.clicks)} hint="de anuncios, bio e historias" />
        <Card label="Entraron" value={count(month.joined)} hint={month.clicks > 0 ? `${percent(month.joined, month.clicks)} de los clics` : "a tus grupos"} />
        <Card label="Se quedaron" value={percent(stayed, month.joined)} hint={`${count(month.left)} salieron`} />
        <Card label="Compraron" value={percent(month.buyers, month.members)} hint={`de ${count(month.members)} miembros`} accent />
      </div>
    </section>
  );
}

function Card({ label, value, hint, accent = false }: { readonly label: string; readonly value: string; readonly hint: string; readonly accent?: boolean }) {
  return (
    <div className={`gr-hero__card${accent ? " gr-hero__card--accent" : ""}`}>
      <span className="gr-hero__card-label">{label}</span>
      <strong className="gr-hero__card-value">{value}</strong>
      <span className="gr-hero__card-hint">{hint}</span>
    </div>
  );
}
