// ---------------------------------------------------------------------------
// El cambio de cada número del resumen frente al periodo anterior (puro): en %
// o, para una tasa, en puntos. El gasto va en gris (subir no es bueno ni malo).
// ---------------------------------------------------------------------------

/** good: mejoró · bad: empeoró · flat: igual, o un número que no es bueno ni malo por sí solo (el gasto). */
export type TrendTone = "good" | "bad" | "flat";

export interface SummaryTrend {
  readonly text: string;
  readonly tone: TrendTone;
}

export const count = (value: number) => value.toLocaleString("es-CO");
export const divide = (a: number, b: number) => (b !== 0 ? a / b : null);

/** El cambio relativo de un número: «▲ 18 %». `neutral` lo pinta gris (subir no es bueno ni malo). */
export function relativeTrend(current: number | null, previous: number | null, sense: "up" | "neutral" = "up"): SummaryTrend | null {
  if (current === null || previous === null || previous === 0) return null;
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (pct === 0) return { text: "= igual", tone: "flat" };
  const up = pct > 0;
  return { text: `${up ? "▲" : "▼"} ${count(Math.abs(pct))} %`, tone: sense === "neutral" ? "flat" : up ? "good" : "bad" };
}

/** El cambio de una tasa, en puntos: de 10 % a 15 % es «▲ 5 pts» (no «▲ 50 %»). */
export function pointsTrend(current: number | null, previous: number | null): SummaryTrend | null {
  if (current === null || previous === null) return null;
  const points = Math.round((current - previous) * 100);
  if (points === 0) return { text: "= igual", tone: "flat" };
  return { text: `${points > 0 ? "▲" : "▼"} ${Math.abs(points)} pts`, tone: points > 0 ? "good" : "bad" };
}
