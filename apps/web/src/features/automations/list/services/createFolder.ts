import { builderApiClient } from "@shared/http/builderApiClient";
import type {
  AutomationFolderSummary,
  CreateFolderRequest
} from "@contracts/AutomationContracts";

/**
 * createFolder — crea una carpeta en el backend.
 *
 * Llama a POST /automations/folders con { name }.
 * NO envía el tenant: el servidor lo resuelve desde la identidad autenticada.
 *
 * Usa builderApiClient: ningún fetch() directo en servicios.
 */
export async function createFolder(name: string): Promise<AutomationFolderSummary> {
  const body: CreateFolderRequest = { name };
  return builderApiClient.post<AutomationFolderSummary>("/automations/folders", body);
}
