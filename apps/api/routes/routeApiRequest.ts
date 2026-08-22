import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateRequest } from "../middleware/authenticateRequest";
import { routeAutomationsRequest } from "./routeAutomationsRequest";
import { routeBuilderApiRequest } from "./routeBuilderApiRequest";
import { sendJson } from "../http/sendJson";
import type { ApiServices } from "../composition/composeBuilderServices";
import type { AuthService } from "../../../platform/identity/application/AuthService";
import type { RequestLogger } from "../../../platform/observability/logging/RequestLogger";

// ---------------------------------------------------------------------------
// routeApiRequest
//
// Responsabilidad única: autenticar y despachar hacia el router de cada área.
//
// `/health` se resuelve antes de autenticar porque es la sonda de disponibilidad.
// ---------------------------------------------------------------------------

export interface ApiRouterDependencies {
  readonly services: ApiServices;
  readonly authService: AuthService;
  readonly requestLogger: RequestLogger;
}

export async function routeApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: ApiRouterDependencies
): Promise<void> {
  const { services, authService, requestLogger } = dependencies;
  const method = request.method ?? "GET";

  if (url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  const requestContext = await authenticateRequest(request, authService);

  if (!requestContext) {
    requestLogger.logUnauthenticated(method, url.pathname, "unknown");
    sendJson(response, 401, { message: "Authentication required" });
    return;
  }

  requestLogger.logReceived(requestContext, method, url.pathname);

  const handledByAutomations = await routeAutomationsRequest(
    request,
    response,
    url,
    services,
    requestContext
  );

  if (handledByAutomations) {
    return;
  }

  await routeBuilderApiRequest(request, response, services, requestContext);
}
