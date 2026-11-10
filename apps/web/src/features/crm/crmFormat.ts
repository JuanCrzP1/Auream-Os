import type { Money, StageOutcome } from "@contracts/CrmContracts";
import type { CrmSource } from "@contracts/CrmActivityContracts";
import { formatMoney } from "@shared/format/formatMoney";
import { timeAgo } from "@shared/format/timeAgo";

// Cómo se dicen las cosas en el CRM: en palabras simples, sin jerga.

export const OUTCOME_LABEL: Readonly<Record<StageOutcome, string>> = { open: "Aún no compra", won: "Ya compró", lost: "No compró" };

export const SOURCE_LABEL: Readonly<Record<CrmSource, string>> = { flow: "por un flujo", user: "a mano", sale: "por una venta", auto: "solo" };

/** «LG» de «Laura Gómez»; con solo teléfono, sus dos últimos dígitos. */
export function initialsOf(name: string | null, phone: string | null = null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) return words.slice(0, 2).map((word) => word[0]!.toUpperCase()).join("");
  return phone ? phone.slice(-2) : "?";
}

/** Varias monedas en una línea: «$ 1.200.000 COP · $ 240 USD». */
export function formatTotals(totals: ReadonlyArray<Money>, empty = "Sin valor"): string {
  return totals.length === 0 ? empty : totals.map((total) => formatMoney(total.amount, total.currency)).join(" · ");
}

/** Hace cuánto: «hace 4 min», «ayer» (compartido con el resto de la app). */
export { timeAgo };

export function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)} %`;
}

const MINUTE = 60_000;
const TIME = new Intl.DateTimeFormat("es", { hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" });

/** Cuándo toca un seguimiento: «Hoy 3:00 p. m.», «Mañana 9:00 a. m.», «vie, 14 nov», «Vencido · hace 2 h». */
export function dueLabel(dueAt: string, now = new Date()): { readonly text: string; readonly tone: "overdue" | "today" | "later" } {
  const due = new Date(dueAt);
  if (due.getTime() < now.getTime()) return { text: `Vencido · ${timeAgo(dueAt, now.getTime())}`, tone: "overdue" };
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * MINUTE;
  if (due.getTime() < startOfToday + dayMs) return { text: `Hoy ${TIME.format(due)}`, tone: "today" };
  if (due.getTime() < startOfToday + 2 * dayMs) return { text: `Mañana ${TIME.format(due)}`, tone: "later" };
  return { text: DAY.format(due), tone: "later" };
}

/** Atajos para un seguimiento nuevo, en la hora del navegador. */
export function quickDueOptions(now = new Date()): ReadonlyArray<{ readonly label: string; readonly at: Date }> {
  const at = (days: number, hour: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, 0, 0);
  return [
    { label: "En 1 hora", at: new Date(now.getTime() + 60 * MINUTE) },
    { label: "Mañana 9:00 a. m.", at: at(1, 9) },
    { label: "En 3 días", at: at(3, 9) },
    { label: "En una semana", at: at(7, 9) }
  ];
}
