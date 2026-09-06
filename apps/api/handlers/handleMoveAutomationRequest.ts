import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import type { MoveAutomationToFolderService } from "../../../domains/automations/catalog/application/MoveAutomationToFolderService";

/**
 * Mueve una automatización a una carpeta.
 *
 * Recurso propio —`/automations/:id/folder`— y no un campo más del PATCH de la
 * automatización: así el renombrado sigue intacto y cada operación dice en su
 * ruta lo que hace. El cuerpo lleva `folderId`, y `null` significa sacarla de
 * la carpeta.
 *
 * Este archivo NO decide nada del movimiento: valida la forma del cuerpo, que
 * es trabajo de HTTP, y delega el resto en el caso de uso, que es quien conoce
 * las reglas —que la carpeta exista, que sea del mismo tenant, que no haya nada
 * que escribir si ya estaba ahí—.
 */
export async function handleMoveAutomationRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: MoveAutomationToFolderService,
  tenantId: string,
  flowId: string
): Promise<void> {
  const body = await parseJsonBody<{ folderId?: string | null }>(request);
  const destino = body.folderId ?? null;

  if (destino !== null && (typeof destino !== "string" || destino.trim().length === 0)) {
    sendJson(response, 400, { message: "folderId debe ser un identificador o null" });
    return;
  }

  try {
    await service.execute(tenantId, flowId, destino);
    // 200 con cuerpo, como el resto de handlers del módulo. Un 204 no puede
    // llevarlo, y enviarlo igualmente hace fallar la respuesta DESPUÉS de
    // haber guardado: el movimiento ocurría y el cliente veía un error.
    sendJson(response, 200, { moved: true });
  } catch {
    // El caso de uso rechaza lo que no existe en ESTE tenant. Desde fuera, un
    // destino ajeno y uno inexistente son lo mismo: no se distingue para no
    // convertir el error en un detector de recursos de otros.
    sendJson(response, 404, { message: "Automatización o carpeta no encontrada" });
  }
}
