import { builderApiClient } from "@shared/http/builderApiClient";
import type { OtherExpenseListResponse, OtherExpenseSummary, SaveOtherExpenseRequest } from "@contracts/OtherExpenseContracts";

// Los otros gastos de la cuenta activa (`/other-expenses`): lo que se paga fuera de Meta.

const id = (value: string) => encodeURIComponent(value);

export const otherExpensesApi = {
  list: () => builderApiClient.get<OtherExpenseListResponse>("/other-expenses"),
  create: (request: SaveOtherExpenseRequest) => builderApiClient.post<OtherExpenseSummary>("/other-expenses", request),
  update: (expenseId: string, request: Partial<SaveOtherExpenseRequest>) => builderApiClient.patch<OtherExpenseSummary>(`/other-expenses/${id(expenseId)}`, request),
  remove: (expenseId: string) => builderApiClient.delete(`/other-expenses/${id(expenseId)}`)
};
