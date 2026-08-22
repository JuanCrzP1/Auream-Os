import type { ServerResponse } from "node:http";
import { sendJson } from "../http/sendJson";
import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import { PublishDraftService } from "../../../domains/automations/builder/application/PublishDraftService";

export async function handlePublishDraftRequest(
  response: ServerResponse,
  getWorkspaceService: GetBuilderWorkspaceService,
  publishDraftService: PublishDraftService,
  tenantId: string,
  flowKey: string
): Promise<void> {
  const workspace = await getWorkspaceService.execute(tenantId, flowKey);
  const nextWorkspace = await publishDraftService.execute(workspace);
  sendJson(response, 200, nextWorkspace);
}