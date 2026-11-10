import type { Trend } from "@contracts/DashboardContracts";
import { formatMoney } from "@shared/format/formatMoney";

// Las palabras del Dashboard: periodos, tendencias y montos en la moneda de reporte.

export type PeriodId = "today" | "7d" | "30d" | "month";
export const PERIODS: ReadonlyArray<readonly [PeriodId, string]> = [["today", "Hoy"], ["7d", "7 días"], ["30d", "30 días"], ["month", "Este mes"]];

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Fechas del periodo (días del navegador; el servidor corta en la hora de la empresa). */
export function rangeOf(period: PeriodId, now = new Date()): { from: string; to: string } {
  const to = iso(now);
  if (period === "today") return { from: to, to };
  if (period === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  const days = period === "7d" ? 7 : 30;
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))), to };
}

export const PERIOD_WORDS: Readonly<Record<PeriodId, string>> = { today: "hoy", "7d": "últimos 7 días", "30d": "últimos 30 días", month: "este mes" };

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
