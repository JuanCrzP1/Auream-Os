import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import type { RenameFolderService } from "../../../domains/automations/catalog/application/RenameFolderService";

/**
 * Renombra una carpeta: `PATCH /automations/folders/:id`.
 *
 * Mismo recurso que ya se usa para crearlas, con el id detrás. No decide nada
 * del renombrado: comprueba la forma del cuerpo, que es trabajo de HTTP, y
 * delega las reglas —que la carpeta exista, que sea de este tenant, que el
 * nombre diga algo— en el caso de uso.
 */
export async function handleRenameFolderRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: RenameFolderService,
  tenantId: string,
  folderId: string
): Promise<void> {
  const body = await parseJsonBody<{ name?: string }>(request);

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    sendJson(response, 400, { message: "name es obligatorio" });
    return;
  }

  try {
    await service.execute(tenantId, folderId, body.name);
    sendJson(response, 200, { renamed: true });
  } catch {
    // Una carpeta de otro tenant y una inexistente son lo mismo desde fuera:
    // no se distingue para no convertir el error en un detector de recursos.
    sendJson(response, 404, { message: "Carpeta no encontrada" });
  }
}
