// ---------------------------------------------------------------------------
// Otros gastos — contrato compartido por la API, la web y el MCP.
//
// Lo que el negocio paga fuera de Meta: herramientas, sueldos, la comisión de
// la pasarela… Un gasto es un MONTO FIJO que se repite (una vez, cada día,
// cada semana o cada mes) o un % DE LAS VENTAS mientras esté vigente. Se aplica
// a todo el negocio o a una línea de venta. El Dashboard lo resta de la
// ganancia; el ROAS sigue siendo solo contra Meta.
// ---------------------------------------------------------------------------

export const EXPENSE_KINDS = ["fixed", "percent"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const EXPENSE_FREQUENCIES = ["once", "daily", "weekly", "monthly"] as const;
export type ExpenseFrequency = (typeof EXPENSE_FREQUENCIES)[number];

export const EXPENSE_NAME_MAX = 60;
export const EXPENSES_PER_TENANT_MAX = 50;

export interface OtherExpenseSummary {
  readonly id: string;
  readonly name: string;
  readonly kind: ExpenseKind;
  /** Monto (`fixed`, en `currency`) o porcentaje de 0 a 100 (`percent`). */
  readonly amount: number;
  /** Solo `fixed`. */
  readonly currency: string | null;
  /** Solo `fixed`. */
  readonly frequency: ExpenseFrequency | null;
  /** `YYYY-MM-DD`: desde cuándo y qué día se cobra (de la semana o del mes). */
  readonly startsOn: string;
  readonly endsOn: string | null;
  /** Línea de venta; `null` = todo el negocio. */
  readonly lineId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OtherExpenseListResponse {
  readonly expenses: ReadonlyArray<OtherExpenseSummary>;
  /** Quien mira puede crear, editar y borrar (`sales.manage`). */
  readonly canManage: boolean;
}

export interface SaveOtherExpenseRequest {
  readonly name: string;
  readonly kind: ExpenseKind;
  /** Número o como lo escribe la persona («1.200.000», «3,5»). */
  readonly amount: number | string;
  readonly currency?: string | null;
  readonly frequency?: ExpenseFrequency | null;
  readonly startsOn: string;
  readonly endsOn?: string | null;
  readonly lineId?: string | null;
}
