import { CURRENCY_CODES } from "../../../contracts/Countries";
import { EXPENSE_FREQUENCIES, EXPENSE_KINDS, EXPENSE_NAME_MAX, type ExpenseFrequency, type ExpenseKind, type SaveOtherExpenseRequest } from "../../../contracts/OtherExpenseContracts";
import { parseAmount } from "../../../flow-engine/values/parseAmount";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Un gasto fuera de Meta: reglas puras.
//
//   fixed    un monto en una moneda que se repite: una vez, cada día, cada
//            semana o cada mes (el día de `startsOn`)
//   percent  un % de lo vendido (de 0 a 100) mientras esté vigente
//
// Los montos se leen con la regla de siempre («1.200.000», «3,5»). Nunca se
// adivina: lo que no se entiende es un error que la persona corrige.
// ---------------------------------------------------------------------------

export interface OtherExpense {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly kind: ExpenseKind;
  readonly amount: number;
  readonly currency: string | null;
  readonly frequency: ExpenseFrequency | null;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly lineId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type OtherExpenseDraft = Pick<OtherExpense, "name" | "kind" | "amount" | "currency" | "frequency" | "startsOn" | "endsOn" | "lineId">;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Tope: cabe en `numeric(14,4)`. */
const MAX_AMOUNT = 9_999_999_999;

function realDay(value: unknown, what: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  const parsed = DAY.test(text) ? new Date(`${text}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw new ValidationError(`Elige ${what} (una fecha válida).`);
  return text;
}

function amountOf(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 10_000) / 10_000 : null;
  return typeof raw === "string" ? parseAmount(raw) : null;
}

export function otherExpenseDraft(input: Partial<SaveOtherExpenseRequest>): OtherExpenseDraft {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new ValidationError("Ponle un nombre al gasto (p. ej. «Comisión de la pasarela»).");
  if (name.length > EXPENSE_NAME_MAX) throw new ValidationError(`El nombre admite hasta ${EXPENSE_NAME_MAX} caracteres.`);
  if (!(EXPENSE_KINDS as ReadonlyArray<string>).includes(String(input.kind))) throw new ValidationError("Elige si es un monto fijo o un % de las ventas.");
  const kind = input.kind as ExpenseKind;

  const amount = amountOf(input.amount);
  if (amount === null || amount > MAX_AMOUNT) throw new ValidationError(kind === "percent" ? "Escribe el porcentaje (p. ej. 3,5)." : "Escribe el monto (p. ej. 1.200.000).");
  if (kind === "percent" && amount > 100) throw new ValidationError("El porcentaje va de 0 a 100.");

  const startsOn = realDay(input.startsOn, "desde cuándo aplica");
  const endsOn = input.endsOn ? realDay(input.endsOn, "hasta cuándo aplica") : null;
  if (endsOn && endsOn < startsOn) throw new ValidationError("La fecha final va después de la inicial.");

  const lineId = input.lineId ? String(input.lineId).trim().toLowerCase() : null;
  if (lineId && !UUID.test(lineId)) throw new ValidationError("Esa línea de venta no existe.");

  if (kind === "percent") return { name, kind, amount, currency: null, frequency: null, startsOn, endsOn, lineId };

  const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "";
  if (!CURRENCY_CODES.includes(currency)) throw new ValidationError("Elige la moneda del gasto.");
  if (!(EXPENSE_FREQUENCIES as ReadonlyArray<string>).includes(String(input.frequency))) throw new ValidationError("Elige cada cuánto se paga: una vez, cada día, cada semana o cada mes.");
  return { name, kind, amount, currency, frequency: input.frequency as ExpenseFrequency, startsOn, endsOn, lineId };
}
