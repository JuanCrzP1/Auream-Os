import type { IncomingMessage, ServerResponse } from "node:http";
import { handleGetBuilderWorkspaceRequest } from "../handlers/handleGetBuilderWorkspaceRequest";
import { handleSaveDraftRequest } from "../handlers/handleSaveDraftRequest";
import { handleSimulateDraftRequest } from "../handlers/handleSimulateDraftRequest";
import { sendJson } from "../http/sendJson";
import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import { SaveDraftService } from "../../../domains/automations/builder/application/SaveDraftService";
import { SimulateDraftService } from "../../../domains/automations/builder/application/SimulateDraftService";
import { TestIntegrationRequestService } from "../../../domains/automations/builder/application/TestIntegrationRequestService";
import type { IntegrationTestRequest } from "../../../contracts/IntegrationTestContracts";
import { TestAiStepService } from "../../../domains/automations/builder/application/TestAiStepService";
import type { AiTestRequest } from "../../../contracts/AiTestContracts";
import { TestPixelEventService } from "../../../domains/automations/builder/application/TestPixelEventService";
import type { PixelTestRequest } from "../../../contracts/PixelTestContracts";
import { parseJsonBody } from "../http/parseJsonBody";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { FlowPermissions } from "../../../platform/authorization/permissions/FlowPermissions";
import { RuntimePermissions } from "../../../platform/authorization/permissions/RuntimePermissions";

export interface BuilderApiServices {
  readonly getWorkspaceService: GetBuilderWorkspaceService;
  readonly saveDraftService: SaveDraftService;
  readonly simulateDraftService: SimulateDraftService;
  readonly testIntegrationService: TestIntegrationRequestService;
  readonly testAiService: TestAiStepService;
  readonly testPixelService: TestPixelEventService;
}

/** Ids de flujo: uuid u otros identificadores seguros para URL. */
const FLOW_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

// Los flujos no se publican ni se versionan: se autoguardan y lo guardado es
// lo que corre (ver ROADMAP, B6). Por eso no hay rutas de publish/rollback.
export async function routeBuilderApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  services: BuilderApiServices,
  requestContext: RequestContext
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const tenantId = requestContext.tenantId;

  // «Probar» del bloque Integración: no depende de un flujo guardado (se prueba
  // lo que hay en el editor). Quien edita flujos puede probar sus bloques.
  if (url.pathname === "/api/builder/integrations/test") {
    if (request.method !== "POST") {
      sendJson(response, 405, { message: "Method not allowed" });
      return;
    }
    requireScope(requestContext, FlowPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<IntegrationTestRequest>>(request);
    sendJson(response, 200, await services.testIntegrationService.execute(tenantId, body));
    return;
  }

  // «Probar» de la Extensión IA: usa la conexión de IA de la cuenta (gasta su saldo).
  if (url.pathname === "/api/builder/ai/test") {
    if (request.method !== "POST") {
      sendJson(response, 405, { message: "Method not allowed" });
      return;
    }
    requireScope(requestContext, FlowPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<AiTestRequest>>(request);
    sendJson(response, 200, await services.testAiService.execute(tenantId, body));
    return;
  }

  // «Probar» del Pixel: envía a Meta con código de prueba (no cuenta como real).
  if (url.pathname === "/api/builder/pixel/test") {
    if (request.method !== "POST") {
      sendJson(response, 405, { message: "Method not allowed" });
      return;
    }
    requireScope(requestContext, FlowPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<PixelTestRequest>>(request);
    sendJson(response, 200, await services.testPixelService.execute(tenantId, body));
    return;
  }

  if (pathParts.length < 4 || pathParts[0] !== "api" || pathParts[1] !== "builder" || pathParts[2] !== "flows") {
    sendJson(response, 404, { message: "Route not found" });
    return;
  }

  const flowKey = pathParts[3]!;

  // Forma del identificador (C4): letras, números, guion y guion bajo.
  if (!FLOW_KEY_PATTERN.test(flowKey)) {
    sendJson(response, 400, { message: "Identificador de flujo inválido" });
    return;
  }

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

  if (request.method === "POST" && action === "simulate") {
    requireScope(requestContext, RuntimePermissions.execute, tenantId);
    await handleSimulateDraftRequest(request, response, services.getWorkspaceService, services.simulateDraftService, tenantId, flowKey);
    return;
  }

  sendJson(response, 404, { message: "Route not found" });
}