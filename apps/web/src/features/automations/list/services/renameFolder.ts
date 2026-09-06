import { builderApiClient } from "@shared/http/builderApiClient";

/**
 * renameFolder — renombra una carpeta en el backend.
 *
 * Llama a PATCH /automations/folders/:id con { name }.
 *
 * NO envía el tenant: el servidor lo resuelve desde la identidad autenticada,
 * igual que el resto de servicios de este módulo.
 */
export async function renameFolder(folderId: string, name: string): Promise<void> {
  await builderApiClient.patch<void>(
    `/automations/folders/${encodeURIComponent(folderId)}`,
    { name }
  );
}
