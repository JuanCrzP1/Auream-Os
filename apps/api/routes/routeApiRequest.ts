import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateRequest } from "../middleware/authenticateRequest";
import { resolveRequestContext } from "../middleware/resolveRequestContext";
import { routeAutomationsRequest } from "./routeAutomationsRequest";
import { routeBuilderApiRequest } from "./routeBuilderApiRequest";
import { routeMeRequest, type MeServices } from "./routeMeRequest";
import { routeContactsRequest } from "./routeContactsRequest";
import type { ContactsServices } from "../composition/composeContactsServices";
import { routeIntegrationsRequest } from "./routeIntegrationsRequest";
import { routeLocalMediaRequest, routeMediaRequest } from "./routeMediaRequest";
import type { MediaServices } from "../composition/composeMediaServices";
import type { IntegrationsServices } from "../composition/composeIntegrationsServices";
import { sendJson } from "../http/sendJson";
import type { ApiServices } from "../composition/composeBuilderServices";
import type { AuthService } from "../../../platform/identity/application/AuthService";
import type { RequestLogger } from "../../../platform/observability/logging/RequestLogger";

// ---------------------------------------------------------------------------
// routeApiRequest
//
// Responsabilidad única: encadenar identidad → tenant → área de negocio.
//
//   /health          sin autenticar (sonda de disponibilidad)
//   /me/*            requiere identidad, NO requiere tenant — es donde el
//                    usuario descubre o crea el suyo
//   resto            requiere identidad Y tenant validado por membership
// ---------------------------------------------------------------------------

export interface ApiRouterDependencies {
  readonly services: ApiServices;
  readonly meServices: MeServices;
  readonly contactsServices: ContactsServices;
  readonly integrationsServices: IntegrationsServices;
  /** `null` si no hay almacén de medios configurado. */
  readonly mediaServices: MediaServices | null;
  readonly authService: AuthService;
  readonly requestLogger: RequestLogger;
}

export async function routeApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: ApiRouterDependencies
): Promise<void> {
  const { services, meServices, contactsServices, integrationsServices, mediaServices, authService, requestLogger } = dependencies;
  const method = request.method ?? "GET";

  if (url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  // Almacén local de medios (solo desarrollo): autoriza el permiso firmado, no la sesión.
  if (await routeLocalMediaRequest(request, response, url, mediaServices)) return;

  const principal = await authenticateRequest(request, authService);

  if (!principal) {
    requestLogger.logUnauthenticated(method, url.pathname, "unknown");
    sendJson(response, 401, { message: "Authentication required" });
    return;
  }

  // Rutas de descubrimiento de tenant: sólo exigen identidad de usuario.
  // `routeMeRequest` rechaza las credenciales de máquina por sí mismo.
  if (url.pathname.startsWith("/me/")) {
    const handled = await routeMeRequest(request, response, url, meServices, principal);

    if (handled) {
      return;
    }
  }

  const resolution = await resolveRequestContext(
    request,
    principal,
    meServices.membershipRepository
  );

  if (resolution.outcome === "forbidden") {
    sendJson(response, 403, { message: "Access denied" });
    return;
  }

  if (resolution.outcome === "tenant_required") {
    sendJson(response, 400, { message: "Tenant selection required" });
    return;
  }

  const requestContext = resolution.context;
  requestLogger.logReceived(requestContext, method, url.pathname);

  if (url.pathname.startsWith("/contacts") || url.pathname.startsWith("/labels")) {
    if (await routeContactsRequest(request, response, url, contactsServices, requestContext)) return;
  }

  if (await routeIntegrationsRequest(request, response, url, integrationsServices, requestContext)) return;
  if (await routeMediaRequest(request, response, url, mediaServices, requestContext)) return;

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
