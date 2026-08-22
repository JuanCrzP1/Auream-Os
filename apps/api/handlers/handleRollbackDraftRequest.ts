import type { ServerResponse } from "node:http";
import { sendJson } from "../http/sendJson";
import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import { RollbackDraftService } from "../../../domains/automations/builder/application/RollbackDraftService";

export async function handleRollbackDraftRequest(
  response: ServerResponse,
  getWorkspaceService: GetBuilderWorkspaceService,
  rollbackDraftService: RollbackDraftService,
  tenantId: string,
  flowKey: string
): Promise<void> {
  const workspace = await getWorkspaceService.execute(tenantId, flowKey);
  const nextWorkspace = await rollbackDraftService.execute(workspace);
  sendJson(response, 200, nextWorkspace);
}