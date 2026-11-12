import type { OtherExpensesReader } from "../../../domains/analytics/application/OtherExpenseLedger";
import { OtherExpenseServices } from "../../../domains/expenses/application/OtherExpenseServices";
import type { SqlExecutor } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlOtherExpenseRepository } from "../../../infrastructure/persistence/sql/SqlOtherExpenseRepository";

// ---------------------------------------------------------------------------
// Otros gastos: el módulo (para `/other-expenses` y el MCP) y lo que el
// Dashboard necesita de él (las reglas de cada gasto), sin que Analytics
// conozca el módulo de gastos.
// ---------------------------------------------------------------------------

export interface OtherExpenseModule {
  readonly expenses: OtherExpenseServices;
  readonly reader: OtherExpensesReader;
}

export function composeOtherExpenseServices(sql: SqlExecutor): OtherExpenseModule {
  const expenses = new OtherExpenseServices(new SqlOtherExpenseRepository(sql));
  return {
    expenses,
    reader: {
      list: async (tenantId) =>
        (await expenses.all(tenantId)).map(({ id, name, kind, amount, currency, frequency, startsOn, endsOn, lineId }) => ({ id, name, kind, amount, currency, frequency, startsOn, endsOn, lineId }))
    }
  };
}
