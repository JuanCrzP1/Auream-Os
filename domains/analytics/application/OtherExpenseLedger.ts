import type { OtherExpenseCharge } from "../../../contracts/DashboardContracts";
import { addDays } from "./DashboardPeriod";
import type { MoneyBook } from "./MoneyBook";
import { round } from "./MoneyBook";

// ---------------------------------------------------------------------------
// Otros gastos (los que no son Meta) en un periodo: reglas puras.
//
//   fijo, una vez        se cobra el día que empieza (si cae en el periodo)
//   fijo, cada día       cada día vigente
//   fijo, cada semana    cada 7 días desde que empieza
//   fijo, cada mes       el día del mes en que empieza (el 31 cae el último
//                        día de los meses cortos)
//   % de las ventas      ese % de lo vendido en los días vigentes
//
// Nada se cobra después de hoy (un gasto futuro aún no se pagó). Cada cobro
// se convierte con la tasa de su día; lo que no se pudo convertir no se suma
// y queda anotado en el `MoneyBook` (nunca un número inventado).
// ---------------------------------------------------------------------------

export interface ExpenseRule {
  readonly id: string;
  readonly name: string;
  readonly kind: "fixed" | "percent";
  /** El monto (fijo) o el porcentaje de 0 a 100. */
  readonly amount: number;
  readonly currency: string | null;
  readonly frequency: "once" | "daily" | "weekly" | "monthly" | null;
  readonly startsOn: string;
  readonly endsOn: string | null;
  /** `null`: es de todo el negocio. */
  readonly lineId: string | null;
}

/** Los otros gastos de la cuenta (los da el módulo de gastos, sin que Analytics lo conozca). */
export interface OtherExpensesReader {
  list(tenantId: string): Promise<ReadonlyArray<ExpenseRule>>;
}

/** Lo vendido un día en una moneda (para los gastos en %). */
export interface RevenueDay {
  readonly day: string;
  readonly currency: string;
  readonly amount: number;
}

/** Lo que costó un gasto en el periodo, en la moneda de reporte. */
export type ExpenseCharge = OtherExpenseCharge;

/** Los gastos de lo que se mira: con una línea, solo los suyos; sin línea, todos. */
export function rulesFor(rules: ReadonlyArray<ExpenseRule>, lineId: string | undefined): ExpenseRule[] {
  const line = lineId?.trim().toLowerCase();
  return line ? rules.filter((rule) => rule.lineId === line) : [...rules];
}

const dayNumber = (day: string) => Number(day.slice(8, 10));
const lastDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/** Los días en que se cobra un gasto fijo dentro de [from, to]. */
export function chargeDays(rule: ExpenseRule, from: string, to: string): string[] {
  const start = rule.startsOn;
  const end = rule.endsOn && rule.endsOn < to ? rule.endsOn : to;
  if (start > end || (rule.endsOn !== null && rule.endsOn < from)) return [];
  switch (rule.frequency) {
    case "once":
      return start >= from && start <= end ? [start] : [];
    case "daily":
      return between(start > from ? start : from, end, 1);
    case "weekly": {
      // El primer cobro en el periodo: el de inicio más los saltos de 7 días que ya pasaron.
      const gap = Math.max(0, Math.ceil(daysBetween(start, from) / 7));
      return between(addDays(start, gap * 7), end, 7);
    }
    case "monthly":
      return monthly(start, from, end);
    default:
      return [];
  }
}

function between(first: string, last: string, step: number): string[] {
  const days: string[] = [];
  for (let day = first; day <= last; day = addDays(day, step)) days.push(day);
  return days;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);
}

function monthly(start: string, from: string, end: string): string[] {
  const days: string[] = [];
  const wanted = dayNumber(start);
  let year = Number((start > from ? start : from).slice(0, 4));
  let month = Number((start > from ? start : from).slice(5, 7)) - 1;
  for (;;) {
    const day = `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(wanted, lastDayOfMonth(year, month))).padStart(2, "0")}`;
    if (day > end) return days;
    if (day >= start && day >= from) days.push(day);
    month += 1;
    if (month === 12) [year, month] = [year + 1, 0];
  }
}

/**
 * Cuánto costó cada gasto en [from, to] (sin pasar de `today`), en la moneda
 * del `book`. `revenue`: lo vendido por día en lo que se mira.
 */
export function chargesOf(
  rules: ReadonlyArray<ExpenseRule>,
  from: string,
  to: string,
  today: string,
  book: MoneyBook,
  revenue: ReadonlyArray<RevenueDay>
): ExpenseCharge[] {
  const until = to < today ? to : today;
  if (from > until) return rules.map(({ id, name }) => ({ id, name, amount: 0 }));
  return rules.map((rule) => ({ id: rule.id, name: rule.name, amount: round(costOf(rule, from, until, book, revenue)) }));
}

function costOf(rule: ExpenseRule, from: string, until: string, book: MoneyBook, revenue: ReadonlyArray<RevenueDay>): number {
  if (rule.kind === "fixed") {
    return rule.currency ? chargeDays(rule, from, until).reduce((sum, day) => sum + book.convert(rule.amount, rule.currency!, day), 0) : 0;
  }
  const first = rule.startsOn > from ? rule.startsOn : from;
  const last = rule.endsOn && rule.endsOn < until ? rule.endsOn : until;
  const sold = revenue.filter((row) => row.day >= first && row.day <= last).reduce((sum, row) => sum + book.convert(row.amount, row.currency, row.day), 0);
  return (sold * rule.amount) / 100;
}

export const totalOf = (charges: ReadonlyArray<ExpenseCharge>) => round(charges.reduce((sum, charge) => sum + charge.amount, 0));
