import { useCallback, useEffect, useState } from "react";
import type { OtherExpenseSummary, SaveOtherExpenseRequest } from "@contracts/OtherExpenseContracts";
import { otherExpensesApi } from "@shared/expenses/otherExpensesApi";

/**
 * Los otros gastos de la cuenta y si quien mira puede cambiarlos. `onChanged`
 * avisa después de guardar o borrar (el Dashboard vuelve a pedir la ganancia).
 */
export function useOtherExpenses(onChanged: () => void) {
  const [expenses, setExpenses] = useState<ReadonlyArray<OtherExpenseSummary> | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await otherExpensesApi.list();
      setExpenses(response.expenses);
      setCanManage(response.canManage);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (request: SaveOtherExpenseRequest, expenseId?: string) => {
      const saved = expenseId ? await otherExpensesApi.update(expenseId, request) : await otherExpensesApi.create(request);
      await refresh();
      onChanged();
      return saved;
    },
    [refresh, onChanged]
  );

  const remove = useCallback(
    async (expenseId: string) => {
      await otherExpensesApi.remove(expenseId);
      await refresh();
      onChanged();
    },
    [refresh, onChanged]
  );

  return { expenses, canManage, failed, save, remove };
}
