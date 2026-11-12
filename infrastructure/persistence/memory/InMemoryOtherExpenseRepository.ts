import type { OtherExpenseRepository } from "../../../domains/expenses/application/OtherExpenseRepository";
import type { OtherExpense, OtherExpenseDraft } from "../../../domains/expenses/domain/OtherExpense";

/** Otros gastos en memoria (pruebas). `lines`: las líneas de venta que existen por cuenta. */
export class InMemoryOtherExpenseRepository implements OtherExpenseRepository {
  public readonly expenses = new Map<string, OtherExpense>();

  public constructor(private readonly lines: ReadonlyMap<string, ReadonlyArray<string>> = new Map()) {}

  public async list(tenantId: string): Promise<OtherExpense[]> {
    return [...this.expenses.values()].filter((expense) => expense.tenantId === tenantId).sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name));
  }

  public async find(tenantId: string, id: string): Promise<OtherExpense | null> {
    const expense = this.expenses.get(id);
    return expense && expense.tenantId === tenantId ? expense : null;
  }

  public async count(tenantId: string): Promise<number> {
    return (await this.list(tenantId)).length;
  }

  public async lineExists(tenantId: string, lineId: string): Promise<boolean> {
    return (this.lines.get(tenantId) ?? []).includes(lineId);
  }

  public async create(tenantId: string, id: string, draft: OtherExpenseDraft): Promise<OtherExpense> {
    const at = new Date().toISOString();
    const expense: OtherExpense = { id, tenantId, ...draft, createdAt: at, updatedAt: at };
    this.expenses.set(id, expense);
    return expense;
  }

  public async update(tenantId: string, id: string, draft: OtherExpenseDraft): Promise<OtherExpense | null> {
    const current = await this.find(tenantId, id);
    if (!current) return null;
    const expense: OtherExpense = { ...current, ...draft, updatedAt: new Date().toISOString() };
    this.expenses.set(id, expense);
    return expense;
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    return (await this.find(tenantId, id)) ? this.expenses.delete(id) : false;
  }
}
