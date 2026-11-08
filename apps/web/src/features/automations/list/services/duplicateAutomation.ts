import { builderApiClient } from "@shared/http/builderApiClient";
import type { AutomationRef } from "@contracts/AutomationContracts";

/** duplicateAutomation — copia completa de una automatización (POST /automations/:id/duplicate). */
export async function duplicateAutomation(flowId: string): Promise<AutomationRef> {
  return builderApiClient.post<AutomationRef>(`/automations/${encodeURIComponent(flowId)}/duplicate`);
}
