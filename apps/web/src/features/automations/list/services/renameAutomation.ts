import { builderApiClient } from "@shared/http/builderApiClient";
import type { AutomationSummary } from "@contracts/AutomationContracts";

/**
 * renameAutomation — renombra un flow en el backend.
 *
 * Llama a PATCH /automations/:id con { name }.
 * Retorna el flow actualizado.
 */
export async function renameAutomation(flowId: string, name: string): Promise<AutomationSummary> {
  return builderApiClient.patch<AutomationSummary>(`/automations/${encodeURIComponent(flowId)}`, { name });
}
