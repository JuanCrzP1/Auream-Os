import type { DayPoint } from "@contracts/DashboardContracts";

// ---------------------------------------------------------------------------
// Con periodos largos (90 días, un año) una barra por día no cabe: el gráfico
// pasa a una por semana (de lunes a domingo). Cada punto lleva el día con que
// empieza. Puro.
// ---------------------------------------------------------------------------

export type ChartUnit = "day" | "week";

/** Hasta este número de días se muestra día por día. */
export const MAX_DAILY_POINTS = 92;

export const chartUnit = (days: number): ChartUnit => (days > MAX_DAILY_POINTS ? "week" : "day");

const mondayOf = (day: string) => {
  const date = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/** Los puntos del gráfico: los días tal cual o sumados por semana. */
export function chartPoints(points: ReadonlyArray<DayPoint>): { readonly unit: ChartUnit; readonly points: ReadonlyArray<DayPoint> } {
  const unit = chartUnit(points.length);
  if (unit === "day") return { unit, points };
  const weeks = new Map<string, { revenue: number; spend: number }>();
  for (const point of points) {
    const week = mondayOf(point.day);
    const sum = weeks.get(week) ?? { revenue: 0, spend: 0 };
    sum.revenue += point.revenue;
    sum.spend += point.spend;
    weeks.set(week, sum);
  }
  // La primera semana arranca el primer día del periodo (no antes).
  const grouped = [...weeks].map(([day, sum], index) => ({ day: index === 0 && points[0] ? points[0].day : day, ...sum }));
  return { unit, points: grouped };
}
