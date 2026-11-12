import type { Trend } from "@contracts/DashboardContracts";
import { formatMoney } from "@shared/format/formatMoney";

// Las palabras del Dashboard: tendencias y montos en la moneda de reporte
// (el periodo está en `period/periodModel`).

/** «▲ 18 %» / «▼ 4 %»; `good` dice si subir es bueno (el gasto o el costo, no). */
export function trendText(trend: Pick<Trend, "change">, good: "up" | "down" = "up"): { readonly text: string; readonly tone: "good" | "bad" | "flat" } | null {
  if (trend.change === null) return null;
  const pct = Math.round(trend.change * 100);
  if (pct === 0) return { text: "= igual", tone: "flat" };
  const up = pct > 0;
  return { text: `${up ? "▲" : "▼"} ${Math.abs(pct)} %`, tone: up === (good === "up") ? "good" : "bad" };
}

export const money = (value: number | null, currency: string) => (value === null ? "—" : formatMoney(Math.round(value), currency));

/** «$ 1,2 M» para ejes y tarjetas pequeñas. */
export const compact = (value: number) => new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
