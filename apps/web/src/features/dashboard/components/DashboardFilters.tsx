import "./dashboard-filters.css";
import "../scope/scope-pop.css";
import { RangePanel } from "../period/RangePanel";
import { periodLabel, PRESET_LABEL, presetRange, QUICK_PRESETS, type DashboardPeriod } from "../period/periodModel";
import { usePopover } from "../scope/usePopover";

/**
 * El periodo: las cápsulas de siempre (Hoy · 7 días · 30 días · Este mes) y
 * «Fechas», que abre los demás atajos y el calendario. La línea, los filtros
 * y la moneda van junto a las pestañas (`scope/ScopeBar`).
 */
export function DashboardFilters({ period, onPeriod }: {
  readonly period: DashboardPeriod;
  readonly onPeriod: (period: DashboardPeriod) => void;
}) {
  const { open, setOpen, toggle, ref } = usePopover<"dates">();
  const quick = period.preset !== null && QUICK_PRESETS.includes(period.preset);
  const choose = (next: DashboardPeriod) => {
    onPeriod(next);
    setOpen(null);
  };

  return (
    <div className="dashboard-filters" ref={ref}>
      <div className="dashboard-filters__periods" role="group" aria-label="Periodo">
        {QUICK_PRESETS.map((id) => (
          <button key={id} type="button" aria-pressed={period.preset === id} onClick={() => choose({ preset: id, ...presetRange(id) })}>{PRESET_LABEL[id]}</button>
        ))}
      </div>
      <div className="dashboard-filters__dates">
        <button
          type="button"
          className="dashboard-filters__dates-btn"
          aria-haspopup="dialog"
          aria-expanded={open === "dates"}
          aria-pressed={!quick}
          aria-label={quick ? "Elegir fechas" : `Fechas: ${periodLabel(period)}`}
          onClick={() => toggle("dates")}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />
          </svg>
          <span>{quick ? "Fechas" : periodLabel(period)}</span>
          <span className="dashboard-filters__caret" aria-hidden="true">▾</span>
        </button>
        {open === "dates" ? <RangePanel period={period} onApply={choose} onClose={() => setOpen(null)} /> : null}
      </div>
    </div>
  );
}
