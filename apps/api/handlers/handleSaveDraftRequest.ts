import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import { SaveDraftService } from "../../../domains/automations/builder/application/SaveDraftService";

export async function handleSaveDraftRequest(
  request: IncomingMessage,
  response: ServerResponse,
  getWorkspaceService: GetBuilderWorkspaceService,
  saveDraftService: SaveDraftService,
  tenantId: string,
  flowKey: string
): Promise<void> {
  const body = await parseJsonBody<{ draft: BuilderFlowSnapshot }>(request);
  const workspace = await getWorkspaceService.execute(tenantId, flowKey);
  const nextWorkspace = await saveDraftService.execute(workspace, body.draft);
  sendJson(response, 200, nextWorkspace);
}