import type { ExpenseFrequency, ExpenseKind, OtherExpenseSummary } from "@contracts/OtherExpenseContracts";
import { formatMoney } from "@shared/format/formatMoney";

// ---------------------------------------------------------------------------
// Cómo se cuenta un gasto en palabras (puro, sin React): la línea corta de la
// lista («$ 600.000 COP cada mes · Venezuela · desde 1 nov.») y la frase que
// confirma el formulario antes de guardar.
// ---------------------------------------------------------------------------

export const FREQUENCY_WORDS: Readonly<Record<ExpenseFrequency, string>> = { once: "una vez", daily: "cada día", weekly: "cada semana", monthly: "cada mes" };
export const FREQUENCY_LABELS: Readonly<Record<ExpenseFrequency, string>> = { once: "Una vez", daily: "Cada día", weekly: "Cada semana", monthly: "Cada mes" };

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);
const format = (day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", ...options }).format(asDate(day));

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"] as const;

/** «1 nov» (igual en todos los navegadores). */
export const shortDay = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1] ?? ""}`;
/** «1 de noviembre» */
export const longDay = (day: string) => format(day, { day: "numeric", month: "long" });
const weekday = (day: string) => format(day, { weekday: "long" });

/** El porcentaje como se escribe aquí: «3,5 %». */
export const percent = (value: number) => `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;

/** Un número como lo escribiría la persona («1.200.000», «3,5»): para volver a editarlo. */
export const amountText = (value: number) => value.toLocaleString("es-CO", { maximumFractionDigits: 4 });

/** Lo que dice la lista bajo el nombre del gasto. */
export function expenseLine(expense: OtherExpenseSummary, lineName: string | null): string {
  const what = expense.kind === "percent"
    ? `${percent(expense.amount)} de las ventas`
    : `${formatMoney(expense.amount, expense.currency ?? "")} ${expense.frequency === "once" ? `el ${shortDay(expense.startsOn)}` : FREQUENCY_WORDS[expense.frequency ?? "monthly"]}`;
  const since = expense.kind === "fixed" && expense.frequency === "once" ? null : `desde ${shortDay(expense.startsOn)}`;
  const until = expense.endsOn ? `hasta ${shortDay(expense.endsOn)}` : null;
  return [what, lineName ?? "todo el negocio", since, until].filter(Boolean).join(" · ");
}

export interface ExpenseDraftWords {
  readonly kind: ExpenseKind;
  /** Tal como lo escribió la persona. */
  readonly amount: string;
  readonly currency: string;
  readonly frequency: ExpenseFrequency;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly lineName: string | null;
}

/** Cuándo se cobra un monto fijo: «(el día 1)», «(cada lunes)». */
function when(frequency: ExpenseFrequency, startsOn: string): string {
  if (frequency === "monthly") return ` (el día ${Number(startsOn.slice(8, 10))})`;
  if (frequency === "weekly") return ` (cada ${weekday(startsOn)})`;
  return "";
}

/** «Se restan $ 1.200.000 COP cada mes (el día 1) de la ganancia de todo el negocio, desde el 1 de noviembre.» */
export function draftSentence(draft: ExpenseDraftWords): string | null {
  const amount = draft.amount.trim();
  if (!amount || !/^\d{4}-\d{2}-\d{2}$/.test(draft.startsOn)) return null;
  const whose = draft.lineName ? `de la línea ${draft.lineName}` : "de todo el negocio";
  const until = /^\d{4}-\d{2}-\d{2}$/.test(draft.endsOn) ? ` hasta el ${longDay(draft.endsOn)}` : "";
  if (draft.kind === "percent") {
    return `Se resta el ${amount} % de lo vendido de la ganancia ${whose}, desde el ${longDay(draft.startsOn)}${until}. El ROAS no cambia.`;
  }
  const money = `$ ${amount} ${draft.currency}`;
  if (draft.frequency === "once") return `Se restan ${money} una sola vez, el ${longDay(draft.startsOn)}, de la ganancia ${whose}.`;
  return `Se restan ${money} ${FREQUENCY_WORDS[draft.frequency]}${when(draft.frequency, draft.startsOn)} de la ganancia ${whose}, desde el ${longDay(draft.startsOn)}${until}.`;
}

/** «Total en los últimos 30 días», «Total de hoy», «Total de este mes». */
export function totalLabel(periodWords: string): string {
  if (periodWords === "hoy" || periodWords === "este mes") return `Total de ${periodWords}`;
  return periodWords.startsWith("últimos") ? `Total en los ${periodWords}` : `Total en ${periodWords}`;
}
