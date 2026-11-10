import { useId } from "react";
import type { DayPoint } from "@contracts/SalesInsightsContracts";
import { formatMoney } from "../salesFormat";
import { chartPath } from "./chartPath";

const W = 600;
const H = 190;
const DAY_LABEL = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
/** «31 oct» (sin «de» ni punto), como en el resto de la portada. */
const label = (day: string) => DAY_LABEL.format(new Date(`${day}T00:00:00Z`)).replace(" de ", " ").replace(".", "");

/** La curva de ventas por día, con el degradado de Auream y el mejor día marcado. */
export function SalesChart({ points, currency }: { readonly points: ReadonlyArray<DayPoint>; readonly currency: string }) {
  const id = useId().replace(/:/g, "");
  const geometry = chartPath(points.map((point) => point.amount), W, H);
  const bestIndex = points.reduce((best, point, index) => (point.amount > (points[best]?.amount ?? 0) ? index : best), 0);
  const best = points[bestIndex];
  const mark = geometry.points[bestIndex];
  const middle = points[Math.floor(points.length / 2)];

  return (
    <figure className="sales-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Ventas por día en ${currency}${best && best.amount > 0 ? `; el mejor día fue el ${label(best.day)} con ${formatMoney(best.amount, currency)}` : ""}`}>
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`line-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="var(--primary)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1="0" x2={W} y1={H * ratio} y2={H * ratio} className="sales-chart__grid" />
        ))}
        <path d={geometry.area} fill={`url(#area-${id})`} />
        <path d={geometry.line} fill="none" stroke={`url(#line-${id})`} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {mark && best && best.amount > 0 ? <line x1={mark.x} x2={mark.x} y1={mark.y} y2={H} className="sales-chart__marker" /> : null}
      </svg>
      {mark && best && best.amount > 0 ? <span className="sales-chart__dot" style={{ left: `${(mark.x / W) * 100}%`, top: `${(mark.y / H) * 100}%` }} aria-hidden="true" /> : null}
      <figcaption className="sales-chart__axis">
        <span>{points[0] ? label(points[0].day) : ""}</span>
        <span>{middle && points.length > 2 ? label(middle.day) : ""}</span>
        {best && best.amount > 0 ? <span className="sales-chart__best">Mejor día: {label(best.day)} · {formatMoney(best.amount, currency)}</span> : null}
        <span>{points.length > 1 ? label(points[points.length - 1]!.day) : ""}</span>
      </figcaption>
    </figure>
  );
}
