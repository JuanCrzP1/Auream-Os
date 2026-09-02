import type { IncomingMessage, ServerResponse } from "node:http";
import { handleCreateFolderRequest } from "../handlers/handleCreateFolderRequest";
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
// Responsabilidad única: enrutar `/automations`, `/automations/folders` y
// `/automations/:id`.
//
// Devuelve `true` si consumió la petición, `false` si la ruta no le pertenece.
// El tenant llega siempre del contexto autenticado, nunca de la URL. Cada
// acción exige el scope correspondiente sobre ese tenant (mismo mecanismo que
// routeBuilderApiRequest): listar/leer exige flows.read, crear carpeta, borrar
// y renombrar exigen flows.write.
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

  // Antes del patrón de `:id`: si no, "folders" se leería como el id de un flow.
  if (url.pathname === "/automations/folders" && request.method === "POST") {
    requireScope(requestContext, FlowPermissions.write, tenantId);
    await handleCreateFolderRequest(request, response, services.createFolderService, tenantId);
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
