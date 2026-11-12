import { randomUUID } from "node:crypto";
import { EXPENSES_PER_TENANT_MAX, type OtherExpenseListResponse, type OtherExpenseSummary, type SaveOtherExpenseRequest } from "../../../contracts/OtherExpenseContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { otherExpenseDraft, type OtherExpense, type OtherExpenseDraft } from "../domain/OtherExpense";
import type { OtherExpenseRepository } from "./OtherExpenseRepository";

// ---------------------------------------------------------------------------
// Otros gastos: ver, crear, editar y borrar. Quién puede lo decide la ruta
// (ver con `analytics.read`, cambiar con `sales.manage`); aquí se validan los
// datos y que la línea de venta sea de la cuenta. Borrar un gasto solo cambia
// la ganancia que muestra el Dashboard: no toca ventas ni anuncios.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toOtherExpenseSummary(expense: OtherExpense): OtherExpenseSummary {
  const { tenantId: _tenant, ...summary } = expense;
  return summary;
}

export class OtherExpenseServices {
  public constructor(
    private readonly repository: OtherExpenseRepository,
    private readonly newId: () => string = randomUUID
  ) {}

  public async list(tenantId: string, canManage: boolean): Promise<OtherExpenseListResponse> {
    return { expenses: (await this.repository.list(tenantId)).map(toOtherExpenseSummary), canManage };
  }

  /** Los gastos de la cuenta tal como los usa el Dashboard. */
  public async all(tenantId: string): Promise<OtherExpense[]> {
    return this.repository.list(tenantId);
  }

  public async create(tenantId: string, input: Partial<SaveOtherExpenseRequest>): Promise<OtherExpenseSummary> {
    const draft = await this.valid(tenantId, input);
    if ((await this.repository.count(tenantId)) >= EXPENSES_PER_TENANT_MAX) {
      throw new ValidationError(`La cuenta llegó a ${EXPENSES_PER_TENANT_MAX} gastos. Borra los que ya no pagues.`);
    }
    return toOtherExpenseSummary(await this.repository.create(tenantId, this.newId(), draft));
  }

  public async update(tenantId: string, id: string, input: Partial<SaveOtherExpenseRequest>): Promise<OtherExpenseSummary> {
    const current = await this.require(tenantId, id);
    // Lo que no llega queda como estaba (editar solo el nombre no cambia el monto).
    const draft = await this.valid(tenantId, {
      name: input.name ?? current.name,
      kind: input.kind ?? current.kind,
      amount: input.amount ?? current.amount,
      currency: input.currency !== undefined ? input.currency : current.currency,
      frequency: input.frequency !== undefined ? input.frequency : current.frequency,
      startsOn: input.startsOn ?? current.startsOn,
      endsOn: input.endsOn !== undefined ? input.endsOn : current.endsOn,
      lineId: input.lineId !== undefined ? input.lineId : current.lineId
    });
    const saved = await this.repository.update(tenantId, id, draft);
    if (!saved) throw new NotFoundError("Ese gasto no existe.");
    return toOtherExpenseSummary(saved);
  }

  public async remove(tenantId: string, id: string): Promise<void> {
    await this.require(tenantId, id);
    await this.repository.remove(tenantId, id);
  }

  private async valid(tenantId: string, input: Partial<SaveOtherExpenseRequest>): Promise<OtherExpenseDraft> {
    const draft = otherExpenseDraft(input);
    if (draft.lineId && !(await this.repository.lineExists(tenantId, draft.lineId))) throw new ValidationError("Esa línea de venta no existe.");
    return draft;
  }

  private async require(tenantId: string, id: string): Promise<OtherExpense> {
    const expense = UUID.test(id) ? await this.repository.find(tenantId, id) : null;
    if (!expense) throw new NotFoundError("Ese gasto no existe.");
    return expense;
  }
}
