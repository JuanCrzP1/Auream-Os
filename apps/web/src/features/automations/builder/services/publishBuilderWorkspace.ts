import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";
import { requestBuilderApi } from "./requestBuilderApi";

export async function publishBuilderWorkspace(flowKey: string): Promise<PersistedBuilderWorkspace> {
  return requestBuilderApi<PersistedBuilderWorkspace>(`/api/builder/flows/${flowKey}/publish`, {
    method: "POST"
  });
}