import "./dashboard-filters.css";
import { PERIODS, type PeriodId } from "../dashboardFormat";

/**
 * El periodo (Hoy · 7 días · 30 días · Este mes). La línea de venta, los
 * filtros y la moneda van junto a las pestañas (`scope/ScopeBar`).
 */
export function DashboardFilters({ period, onPeriod }: {
  readonly period: PeriodId;
  readonly onPeriod: (period: PeriodId) => void;
}) {
  return (
    <div className="dashboard-filters">
      <div className="dashboard-filters__periods" role="group" aria-label="Periodo">
        {PERIODS.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={period === id} onClick={() => onPeriod(id)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
