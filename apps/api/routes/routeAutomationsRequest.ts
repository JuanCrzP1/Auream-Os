import type { IncomingMessage, ServerResponse } from "node:http";
import { handleDeleteAutomationRequest } from "../handlers/handleDeleteAutomationRequest";
import { handleRenameAutomationRequest } from "../handlers/handleRenameAutomationRequest";
import { sendJson } from "../http/sendJson";
import { toAutomationListResponse } from "../http/toAutomationListResponse";
import type { ApiServices } from "../composition/composeBuilderServices";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { FlowPermissions } from "../../../platform/authorization/permissions/FlowPermissions";

// ---------------------------------------------------------------------------
// routeAutomationsRequest
//
// Responsabilidad única: enrutar `/automations` y `/automations/:id`.
//
// Devuelve `true` si consumió la petición, `false` si la ruta no le pertenece.
// El tenant llega siempre del contexto autenticado, nunca de la URL. Cada
// acción exige el scope correspondiente sobre ese tenant (mismo mecanismo que
// routeBuilderApiRequest): listar/leer exige flows.read, borrar y renombrar
// exigen flows.write.
// ---------------------------------------------------------------------------

const AUTOMATION_ID_PATTERN = /^\/automations\/([^/]+)$/;

export async function routeAutomationsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: ApiServices,
  requestContext: RequestContext
): Promise<boolean> {
  const tenantId = requestContext.tenantId;

  if (url.pathname === "/automations" && request.method === "GET") {
    requireScope(requestContext, FlowPermissions.read, tenantId);
    const result = await services.listAutomationsService.execute(tenantId);
    sendJson(response, 200, toAutomationListResponse(result));
    return true;
  }

  const match = AUTOMATION_ID_PATTERN.exec(url.pathname);

  if (!match) {
    return false;
  }

  const flowId = match[1]!;

  if (request.method === "DELETE") {
    requireScope(requestContext, FlowPermissions.write, tenantId);
    await handleDeleteAutomationRequest(response, services.deleteAutomationService, tenantId, flowId);
    return true;
  }

  if (request.method === "PATCH") {
    requireScope(requestContext, FlowPermissions.write, tenantId);
    await handleRenameAutomationRequest(
      request,
      response,
      services.automationRepository,
      tenantId,
      flowId
    );
    return true;
  }

  return false;
}
