import type { OtherExpense, OtherExpenseDraft } from "../domain/OtherExpense";

/** Los otros gastos de cada cuenta. Todo filtra por cuenta. */
export interface OtherExpenseRepository {
  list(tenantId: string): Promise<OtherExpense[]>;
  find(tenantId: string, id: string): Promise<OtherExpense | null>;
  count(tenantId: string): Promise<number>;
  /** ¿La línea de venta es de esta cuenta? */
  lineExists(tenantId: string, lineId: string): Promise<boolean>;
  create(tenantId: string, id: string, draft: OtherExpenseDraft): Promise<OtherExpense>;
  /** `null` si no existe en esa cuenta. */
  update(tenantId: string, id: string, draft: OtherExpenseDraft): Promise<OtherExpense | null>;
  /** `true` si existía. */
  remove(tenantId: string, id: string): Promise<boolean>;
}
