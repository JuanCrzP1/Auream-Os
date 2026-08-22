import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import { toAutomationSummary } from "../http/toAutomationListResponse";
import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";

export async function handleRenameAutomationRequest(
  request: IncomingMessage,
  response: ServerResponse,
  automationRepository: AutomationRepository,
  tenantId: string,
  flowId: string
): Promise<void> {
  const body = await parseJsonBody<{ name: string }>(request);

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    sendJson(response, 400, { message: "name es obligatorio" });
    return;
  }

  const existing = await automationRepository.findById(tenantId, flowId);
  if (!existing) {
    sendJson(response, 404, { message: "Flow no encontrado" });
    return;
  }

  const updated = {
    ...existing,
    name: body.name.trim(),
    metadata: {
      ...existing.metadata,
      updatedAt: new Date().toISOString()
    }
  };

  await automationRepository.save(updated);
  sendJson(response, 200, toAutomationSummary(updated));
}
