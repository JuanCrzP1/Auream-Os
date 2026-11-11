import "./results-funnel.css";
import type { BroadcastStats } from "@contracts/BroadcastResultsContracts";
import { formatMoney } from "@shared/format/formatMoney";
import { count, money, percent } from "../broadcastFormat";

/** Del envío a la venta: lo primero es la plata; después cada paso con su porcentaje. */
export function ResultsFunnel({ stats }: { readonly stats: BroadcastStats }) {
  const revenue = money(stats.revenue);
  const main = stats.revenue[0];
  const per100 = main && stats.sent > 0 ? formatMoney(Math.round((main.amount / stats.sent) * 100), main.currency) : null;
  const steps = [
    { label: "Enviados", value: stats.sent, note: stats.failed > 0 ? `${count(stats.failed)} fallaron` : `de ${count(stats.total)}` },
    { label: "Entregados", value: stats.delivered, note: percent(stats.delivered, stats.sent) },
    { label: "Leídos", value: stats.read, note: percent(stats.read, stats.sent) },
    { label: "Respondieron", value: stats.replied, note: `${percent(stats.replied, stats.sent)} · ${count(stats.replied)} chats` },
    { label: "Compraron", value: stats.bought, note: percent(stats.bought, stats.sent), accent: true }
  ];
  return (
    <section className="bc-funnel" aria-label="Del envío a la venta">
      <div className="bc-funnel__head">
        <div>
          <span className="bc-funnel__label">Del envío a la venta</span>
          <strong className="bc-funnel__money">{revenue.main}</strong>
          <span className="bc-funnel__sentence">
            {stats.bought === 0 ? "Aún sin ventas: cuentan las de los 3 días después de recibirla." : `${count(stats.bought)} ${stats.bought === 1 ? "venta" : "ventas"}${per100 ? ` · cada 100 mensajes dejaron ${per100}` : ""}`}
            {revenue.others > 0 ? ` · más ${revenue.others} moneda${revenue.others > 1 ? "s" : ""}` : ""}
          </span>
        </div>
        <span className="bc-funnel__rule">Cuenta para la última difusión que recibió el cliente antes de comprar</span>
      </div>
      <div className="bc-funnel__steps">
        {steps.map((step) => (
          <div key={step.label} className={`bc-funnel__step${step.accent ? " bc-funnel__step--accent" : ""}`}>
            <span className="bc-funnel__step-label">{step.label}</span>
            <strong>{count(step.value)}</strong>
            <span className="bc-funnel__track"><span style={{ width: `${stats.total > 0 ? Math.max(3, Math.round((step.value / Math.max(stats.total, 1)) * 100)) : 0}%` }} /></span>
            <span className="bc-funnel__note">{step.note}</span>
          </div>
        ))}
      </div>
      {stats.optedOut > 0 ? <span className="bc-funnel__sentence">{count(stats.optedOut)} pidieron no recibir más: ya salieron de todas tus listas.</span> : null}
    </section>
  );
}
