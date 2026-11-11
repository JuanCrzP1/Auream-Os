import "./month-hero.css";
import type { BroadcastListResponse } from "@contracts/BroadcastResultsContracts";
import { count, money, percent } from "../broadcastFormat";

/** Lo de este mes: primero la plata que trajeron las difusiones, después el embudo. */
export function MonthHero({ month }: { readonly month: BroadcastListResponse["month"] }) {
  const revenue = money(month.revenue);
  return (
    <section className="bc-month" aria-label="Difusiones este mes">
      <div className="bc-month__lead">
        <span className="bc-month__label">Vendido con difusiones · este mes</span>
        <strong className="bc-month__money">{revenue.main}</strong>
        <span className="bc-month__sentence">
          {month.bought === 0
            ? "Cuando alguien compre en los 3 días después de recibir una difusión, aparece aquí."
            : `${count(month.bought)} ${month.bought === 1 ? "cliente compró" : "clientes compraron"} en los 3 días después de recibir una difusión.`}
          {revenue.others > 0 ? ` Más ${revenue.others} ${revenue.others === 1 ? "moneda" : "monedas"}.` : ""}
        </span>
      </div>
      <div className="bc-month__grid">
        <Card label="Enviados" value={count(month.sent)} hint={`en ${month.broadcasts} ${month.broadcasts === 1 ? "difusión" : "difusiones"}`} />
        <Card label="Los leyeron" value={percent(month.read, month.sent)} hint={`${count(month.read)} personas`} />
        <Card label="Respondieron" value={percent(month.replied, month.sent)} hint={`${count(month.replied)} chats`} />
        <Card label="Compraron" value={percent(month.bought, month.sent)} hint={`${count(month.bought)} ventas`} accent />
      </div>
    </section>
  );
}

function Card({ label, value, hint, accent = false }: { readonly label: string; readonly value: string; readonly hint: string; readonly accent?: boolean }) {
  return (
    <div className={`bc-month__card${accent ? " bc-month__card--accent" : ""}`}>
      <span className="bc-month__card-label">{label}</span>
      <strong className="bc-month__card-value">{value}</strong>
      <span className="bc-month__card-hint">{hint}</span>
    </div>
  );
}
