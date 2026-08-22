import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";
import { requestBuilderApi } from "./requestBuilderApi";

export async function saveBuilderDraft(flowKey: string, draft: BuilderFlowSnapshot): Promise<PersistedBuilderWorkspace> {
  return requestBuilderApi<PersistedBuilderWorkspace>(`/api/builder/flows/${flowKey}/draft`, {
    method: "PUT",
    body: JSON.stringify({ draft })
  });
}