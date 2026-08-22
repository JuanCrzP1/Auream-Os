import type { ServerResponse } from "node:http";
import { sendJson } from "../http/sendJson";
import type { DeleteAutomationService } from "../../../domains/automations/builder/application/DeleteAutomationService";

export async function handleDeleteAutomationRequest(
  response: ServerResponse,
  deleteAutomationService: DeleteAutomationService,
  tenantId: string,
  flowId: string
): Promise<void> {
  await deleteAutomationService.execute(tenantId, flowId);
  sendJson(response, 200, { deleted: true });
}
