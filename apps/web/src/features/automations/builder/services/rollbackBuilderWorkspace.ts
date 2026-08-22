import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";
import { requestBuilderApi } from "./requestBuilderApi";

export async function rollbackBuilderWorkspace(flowKey: string): Promise<PersistedBuilderWorkspace> {
  return requestBuilderApi<PersistedBuilderWorkspace>(`/api/builder/flows/${flowKey}/rollback`, {
    method: "POST"
  });
}