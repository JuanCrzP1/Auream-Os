import { builderApiClient } from "@shared/http/builderApiClient";

/**
 * deleteAutomation — elimina un flow del backend.
 *
 * Llama a DELETE /automations/:id.
 * El backend elimina tanto la metadata del catálogo como el workspace del builder.
 */
export async function deleteAutomation(flowId: string): Promise<void> {
  await builderApiClient.delete(`/automations/${encodeURIComponent(flowId)}`);
}
