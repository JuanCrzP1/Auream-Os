import "./revenue-chart.css";
import type { DayPoint } from "@contracts/DashboardContracts";
import { compact, money } from "../dashboardFormat";
import { dayLabel as label } from "../period/periodModel";
import { chartPoints } from "./chartBuckets";

const W = 900;
const H = 220;

/**
 * Una curva suave que NUNCA se pasa de los puntos (cúbica monótona,
 * Fritsch–Carlson): entre dos días sin ventas la línea queda en cero, sin
 * «globos» ni picos que no hubo.
 */
export function smooth(points: ReadonlyArray<readonly [number, number]>): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0]![0]},${points[0]![1]}`;
  const dx = points.slice(1).map((p, i) => p[0] - points[i]![0]);
  const slope = points.slice(1).map((p, i) => (p[1] - points[i]![1]) / (dx[i] || 1));
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0]!;
    if (i === n - 1) return slope[n - 2]!;
    const a = slope[i - 1]!;
    const b = slope[i]!;
    return a * b <= 0 ? 0 : (a + b) / 2;
  });
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i]! / slope[i]!;
    const b = tangent[i + 1]! / slope[i]!;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i]!;
      tangent[i + 1] = t * b * slope[i]!;
    }
  }
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const third = dx[i]! / 3;
    d += ` C${(x0 + third).toFixed(1)},${(y0 + tangent[i]! * third).toFixed(1)} ${(x1 - third).toFixed(1)},${(y1 - tangent[i + 1]! * third).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

/**
 * Facturación (curva) y gasto en Meta (barras) por día —o por semana en
 * periodos largos—, en la moneda de reporte; con gasto, la ganancia
 * (punteada). Marca el mejor día o semana.
 */
export function RevenueChart({ points: days, currency, withSpend }: { readonly points: ReadonlyArray<DayPoint>; readonly currency: string; readonly withSpend: boolean }) {
  const { unit, points } = chartPoints(days);
  const withYear = (days[0]?.day.slice(0, 4) ?? "") !== (days[days.length - 1]?.day.slice(0, 4) ?? "");
  const bestWord = unit === "week" ? "Mejor semana: la del" : "Mejor día:";
  const max = Math.max(1, ...points.map((p) => Math.max(p.revenue, withSpend ? p.spend : 0)));
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const x = (i: number) => (points.length > 1 ? i * step : W / 2);
  const y = (value: number) => H - 12 - (Math.max(0, value) / max) * (H - 30);
  const revenue = points.map((p, i) => [x(i), y(p.revenue)] as const);
  const profit = points.map((p, i) => [x(i), y(p.revenue - p.spend)] as const);
  const best = points.reduce((top, p, i) => (p.revenue > (points[top]?.revenue ?? -1) ? i : top), 0);
  const barWidth = Math.max(4, Math.min(22, step * 0.55));
  const bars = withSpend ? points.map((p, i) => `M${(x(i) - barWidth / 2).toFixed(1)},${H} V${y(p.spend).toFixed(1)} h${barWidth.toFixed(1)} V${H} Z`).join(" ") : "";
  const area = revenue.length > 0 ? `${smooth(revenue)} L${x(points.length - 1)},${H} L${x(0)},${H} Z` : "";
  const bestPoint = points[best];

  return (
    <figure className="revenue-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="revenue-chart__svg" role="img" aria-label={`Facturación${withSpend ? " y gasto" : ""} por ${unit === "week" ? "semana" : "día"}; ${unit === "week" ? "la mejor semana" : "el mejor día"} facturó ${money(bestPoint?.revenue ?? 0, currency)}`}>
        <defs>
          <linearGradient id="revenue-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="revenue-chart__grid" />)}
        {withSpend ? <path d={bars} className="revenue-chart__spend" /> : null}
        <path d={area} fill="url(#revenue-area)" />
        <path d={smooth(revenue)} className="revenue-chart__line" />
        {withSpend ? <path d={smooth(profit)} className="revenue-chart__profit" /> : null}
        {bestPoint && bestPoint.revenue > 0 ? <circle cx={x(best)} cy={y(bestPoint.revenue)} r="6" className="revenue-chart__best" /> : null}
      </svg>
      <figcaption className="revenue-chart__axis">
        <span>{days[0] ? label(days[0].day, withYear) : ""}</span>
        {bestPoint && bestPoint.revenue > 0 ? (
          <span className="revenue-chart__best-label">
            {bestWord} {label(bestPoint.day)} · facturó $ {compact(bestPoint.revenue)}{withSpend ? ` con $ ${compact(bestPoint.spend)} de gasto` : ""}
          </span>
        ) : null}
        <span>{days.length > 0 ? label(days[days.length - 1]!.day, withYear) : ""}</span>
      </figcaption>
    </figure>
  );
}
