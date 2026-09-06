import { builderApiClient } from "@shared/http/builderApiClient";

/**
 * moveAutomationToFolder — mueve un flow a una carpeta en el backend.
 *
 * Llama a PATCH /automations/:id/folder con { folderId }.
 * `null` saca el flow de su carpeta y lo devuelve a la raíz.
 *
 * NO envía el tenant: el servidor lo resuelve desde la identidad autenticada,
 * igual que el resto de servicios de este módulo.
 */
export async function moveAutomationToFolder(
  flowId: string,
  folderId: string | null
): Promise<void> {
  await builderApiClient.patch<void>(
    `/automations/${encodeURIComponent(flowId)}/folder`,
    { folderId }
  );
}
