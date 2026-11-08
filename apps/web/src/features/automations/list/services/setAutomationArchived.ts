import { builderApiClient } from "@shared/http/builderApiClient";
import type { AutomationRef, SetAutomationArchivedRequest } from "@contracts/AutomationContracts";

/** setAutomationArchived — archiva (`true`) o restaura (`false`) una automatización. */
export async function setAutomationArchived(flowId: string, archived: boolean): Promise<AutomationRef> {
  const body: SetAutomationArchivedRequest = { archived };
  return builderApiClient.patch<AutomationRef>(`/automations/${encodeURIComponent(flowId)}/archive`, body);
}
