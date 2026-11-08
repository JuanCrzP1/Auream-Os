import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import { SaveDraftService } from "../../../domains/automations/builder/application/SaveDraftService";
import { isBuilderFlowSnapshot } from "../../../domains/automations/builder/application/isBuilderFlowSnapshot";

export async function handleSaveDraftRequest(
  request: IncomingMessage,
  response: ServerResponse,
  getWorkspaceService: GetBuilderWorkspaceService,
  saveDraftService: SaveDraftService,
  tenantId: string,
  flowKey: string
): Promise<void> {
  const body = await parseJsonBody<{ draft?: unknown; baseRevision?: unknown }>(request);

  // Forma del cuerpo (C4): un borrador legible y, si viene, una revisión base.
  if (!isBuilderFlowSnapshot(body.draft)) {
    sendJson(response, 400, { message: "draft no tiene la forma de un flujo" });
    return;
  }
  if (body.baseRevision !== undefined && !(Number.isInteger(body.baseRevision) && (body.baseRevision as number) >= 0)) {
    sendJson(response, 400, { message: "baseRevision debe ser un entero mayor o igual que cero" });
    return;
  }

  const workspace = await getWorkspaceService.execute(tenantId, flowKey);
  if (!workspace) {
    sendJson(response, 404, { message: "Automatización no encontrada" });
    return;
  }
  const draft: BuilderFlowSnapshot = body.draft;
  const nextWorkspace = await saveDraftService.execute(workspace, draft, {
    ...(body.baseRevision !== undefined ? { baseRevision: body.baseRevision as number } : {})
  });
  sendJson(response, 200, nextWorkspace);
}