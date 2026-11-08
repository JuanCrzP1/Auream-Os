import type { ServerResponse } from "node:http";
import { sendJson } from "../http/sendJson";
import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";

export async function handleGetBuilderWorkspaceRequest(
  response: ServerResponse,
  service: GetBuilderWorkspaceService,
  tenantId: string,
  flowKey: string
): Promise<void> {
  const workspace = await service.execute(tenantId, flowKey);
  // Abrir no crea: un id que no existe en este tenant es un 404.
  if (!workspace) {
    sendJson(response, 404, { message: "Automatización no encontrada" });
    return;
  }
  sendJson(response, 200, workspace);
}