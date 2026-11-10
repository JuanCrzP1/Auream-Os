import "./pipeline-stats.css";
import type { PipelineMetrics } from "@contracts/CrmContracts";
import { formatMoney } from "@shared/format/formatMoney";

/**
 * Los cuatro números del embudo, dichos como los diría el dueño: cuánto falta
 * por cerrar, cuánto se vendió, de cada 100 cuántos compran y cuánto tardan.
 * Si hay varias monedas, la principal en grande y las demás debajo.
 */
export function PipelineStats({ metrics }: { readonly metrics: PipelineMetrics }) {
  const [openMain, ...openRest] = metrics.openTotals;
  const [wonMain, ...wonRest] = metrics.wonTotals;
  const rate = metrics.closeRate === null ? null : Math.round(metrics.closeRate * 100);
  return (
    <section className="pipeline-stats" aria-label="Resumen del embudo">
      <div className="pipeline-stats__card pipeline-stats__card--lead">
        <span className="pipeline-stats__label">Por cerrar</span>
        <span className="pipeline-stats__value">{openMain ? formatMoney(openMain.amount, openMain.currency) : "Sin valor"}</span>
        <span className="pipeline-stats__meta">
          {metrics.openCount === 1 ? "1 cliente que aún no compra" : `${metrics.openCount} clientes que aún no compran`}
          {openRest.length > 0 ? ` · + ${openRest.map((total) => formatMoney(total.amount, total.currency)).join(" · ")}` : ""}
        </span>
      </div>
      <div className="pipeline-stats__card">
        <span className="pipeline-stats__label">Vendido · 30 días</span>
        <span className="pipeline-stats__value pipeline-stats__value--won">{wonMain ? formatMoney(wonMain.amount, wonMain.currency) : "—"}</span>
        <span className="pipeline-stats__meta">
          {metrics.wonCount === 1 ? "1 cliente compró" : `${metrics.wonCount} clientes compraron`}
          {wonRest.length > 0 ? ` · + ${wonRest.map((total) => formatMoney(total.amount, total.currency)).join(" · ")}` : ""}
        </span>
      </div>
      <div className="pipeline-stats__card">
        <span className="pipeline-stats__label">De cada 100 en el embudo</span>
        <span className="pipeline-stats__value">{rate === null ? "—" : `${rate} compran`}</span>
        <span className="pipeline-stats__meta">{metrics.lostCount > 0 ? `${metrics.lostCount} no compraron` : "Nadie se ha perdido"}</span>
      </div>
      <div className="pipeline-stats__card">
        <span className="pipeline-stats__label">Tardan en comprar</span>
        <span className="pipeline-stats__value">{metrics.avgDaysToClose === null ? "—" : `${metrics.avgDaysToClose.toLocaleString("es-CO")} días`}</span>
        <span className="pipeline-stats__meta">desde que entran (últimos 90 días)</span>
      </div>
    </section>
  );
}
