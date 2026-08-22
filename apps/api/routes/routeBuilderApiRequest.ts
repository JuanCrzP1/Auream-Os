import type { IncomingMessage, ServerResponse } from "node:http";
import { handleGetBuilderWorkspaceRequest } from "../handlers/handleGetBuilderWorkspaceRequest";
import { handlePublishDraftRequest } from "../handlers/handlePublishDraftRequest";
import { handleRollbackDraftRequest } from "../handlers/handleRollbackDraftRequest";
import { handleSaveDraftRequest } from "../handlers/handleSaveDraftRequest";
import { handleSimulateDraftRequest } from "../handlers/handleSimulateDraftRequest";
import { sendJson } from "../http/sendJson";
import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import { PublishDraftService } from "../../../domains/automations/builder/application/PublishDraftService";
import { RollbackDraftService } from "../../../domains/automations/builder/application/RollbackDraftService";
import { SaveDraftService } from "../../../domains/automations/builder/application/SaveDraftService";
import { SimulateDraftService } from "../../../domains/automations/builder/application/SimulateDraftService";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { FlowPermissions } from "../../../platform/authorization/permissions/FlowPermissions";
import { RuntimePermissions } from "../../../platform/authorization/permissions/RuntimePermissions";

export interface BuilderApiServices {
  readonly getWorkspaceService: GetBuilderWorkspaceService;
  readonly saveDraftService: SaveDraftService;
  readonly publishDraftService: PublishDraftService;
  readonly rollbackDraftService: RollbackDraftService;
  readonly simulateDraftService: SimulateDraftService;
}

export async function routeBuilderApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  services: BuilderApiServices,
  requestContext: RequestContext
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const tenantId = requestContext.tenantId;

  if (pathParts.length < 4 || pathParts[0] !== "api" || pathParts[1] !== "builder" || pathParts[2] !== "flows") {
    sendJson(response, 404, { message: "Route not found" });
    return;
  }

  const flowKey = pathParts[3];
  const action = pathParts[4] ?? "workspace";

  if (request.method === "GET" && action === "workspace") {
    requireScope(requestContext, FlowPermissions.read, tenantId);
    await handleGetBuilderWorkspaceRequest(response, services.getWorkspaceService, tenantId, flowKey);
    return;
  }

  if (request.method === "PUT" && action === "draft") {
    requireScope(requestContext, FlowPermissions.write, tenantId);
    await handleSaveDraftRequest(request, response, services.getWorkspaceService, services.saveDraftService, tenantId, flowKey);
    return;
  }

  if (request.method === "POST" && action === "publish") {
    requireScope(requestContext, FlowPermissions.publish, tenantId);
    await handlePublishDraftRequest(response, services.getWorkspaceService, services.publishDraftService, tenantId, flowKey);
    return;
  }

  if (request.method === "POST" && action === "rollback") {
    requireScope(requestContext, FlowPermissions.write, tenantId);
    await handleRollbackDraftRequest(response, services.getWorkspaceService, services.rollbackDraftService, tenantId, flowKey);
    return;
  }

  if (request.method === "POST" && action === "simulate") {
    requireScope(requestContext, RuntimePermissions.execute, tenantId);
    await handleSimulateDraftRequest(request, response, services.getWorkspaceService, services.simulateDraftService, tenantId, flowKey);
    return;
  }

  sendJson(response, 404, { message: "Route not found" });
}