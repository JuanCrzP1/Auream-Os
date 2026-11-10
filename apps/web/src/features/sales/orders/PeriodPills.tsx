import "./period-pills.css";
import { isoDay } from "../salesFormat";

export type SalesPeriod = "today" | "7d" | "30d" | "month" | "all";

export const PERIODS: ReadonlyArray<{ readonly id: SalesPeriod; readonly label: string; readonly long: string }> = [
  { id: "today", label: "Hoy", long: "hoy" },
  { id: "7d", label: "7 días", long: "últimos 7 días" },
  { id: "30d", label: "30 días", long: "últimos 30 días" },
  { id: "month", label: "Este mes", long: "este mes" },
  { id: "all", label: "Todo", long: "desde el inicio" }
];

/** Las fechas del periodo (`YYYY-MM-DD`); el servidor las lee en la hora de la empresa. */
export function periodRange(period: SalesPeriod, now = new Date()): { from?: string; to?: string } {
  const today = isoDay(now);
  const daysAgo = (days: number) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
  if (period === "today") return { from: today, to: today };
  if (period === "7d") return { from: daysAgo(6), to: today };
  if (period === "30d") return { from: daysAgo(29), to: today };
  if (period === "month") return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  return {};
}

/** El periodo en botones (no en una lista): se ve de un vistazo y se cambia con un toque. */
export function PeriodPills({ value, onChange }: { readonly value: SalesPeriod; readonly onChange: (period: SalesPeriod) => void }) {
  return (
    <div className="period-pills" role="group" aria-label="Periodo">
      {PERIODS.map((period) => (
        <button key={period.id} type="button" className="period-pills__option" aria-pressed={period.id === value} onClick={() => onChange(period.id)}>
          {period.label}
        </button>
      ))}
    </div>
  );
}
