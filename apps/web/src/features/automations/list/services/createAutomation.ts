import { builderApiClient } from "@shared/http/builderApiClient";
import type { AutomationRef, CreateAutomationRequest } from "@contracts/AutomationContracts";

/**
 * createAutomation — crea una automatización en el backend (POST /automations).
 *
 * El id lo decide el servidor. Antes lo inventaba el cliente y la creación
 * ocurría al abrir el builder, con un GET.
 */
export async function createAutomation(request: CreateAutomationRequest = {}): Promise<AutomationRef> {
  return builderApiClient.post<AutomationRef>("/automations", request);
}
