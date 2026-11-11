import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateRequest } from "../middleware/authenticateRequest";
import { resolveRequestContext } from "../middleware/resolveRequestContext";
import { clientIp, enforceRateLimit, TENANT_API_POLICY, UNAUTHENTICATED_POLICY } from "../middleware/limitRequests";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import { routeAutomationsRequest } from "./routeAutomationsRequest";
import { routeBuilderApiRequest } from "./routeBuilderApiRequest";
import { routeMeRequest, type MeServices } from "./routeMeRequest";
import { routeContactsRequest } from "./routeContactsRequest";
import type { ContactsServices } from "../composition/composeContactsServices";
import { routeIntegrationsRequest } from "./routeIntegrationsRequest";
import { routeCompanyRequest } from "./routeCompanyRequest";
import { routeTeamRequest } from "./routeTeamRequest";
import { routeSalesRequest, type SalesRoutes } from "./routeSalesRequest";
import { routeCrmRequest, type CrmRoutes } from "./routeCrmRequest";
import { routeBroadcastsRequest, type BroadcastRoutes } from "./routeBroadcastsRequest";
import { routeGroupsRequest, type GroupRoutes } from "./routeGroupsRequest";
import { routeGroupLink } from "./routeGroupLink";
import { routeHelpRequest, type HelpRoutes } from "./routeHelpRequest";
import { routeHelpDocs } from "./routeHelpDocs";
import type { LinkService } from "../../../domains/groups/application/LinkService";
import type { GroupActivity } from "../../../domains/groups/application/GroupActivity";
import { routeAdsRequest } from "./routeAdsRequest";
import { routeAdsCallback } from "./routeAdsCallback";
import { routeDashboardRequest } from "./routeDashboardRequest";
import type { AdsModule } from "../composition/composeAdsServices";
import { recordLastSeen } from "../middleware/recordLastSeen";
import { routeInvitationPublic } from "./routeInvitationPublic";
import type { TeamServices } from "../../../domains/team/application/TeamServices";
import type { InvitationServices } from "../../../domains/team/application/InvitationServices";
import type { CompanyServices } from "../../../domains/company/application/CompanyServices";
import { routeConnectionsRequest } from "./routeConnectionsRequest";
import { routeWhatsAppWebhooks } from "./routeWhatsAppWebhooks";
import { routeInternalTasks, type InternalTasksDependencies } from "./routeInternalTasks";
import { routeInboundWebhook } from "./routeInboundWebhook";
import { routeWebhooksRequest } from "./routeWebhooksRequest";
import { routeMcp } from "./routeMcp";
import { routeMcpCredentialsRequest } from "./routeMcpCredentialsRequest";
import { routeOAuthPublic } from "./routeOAuthPublic";
import { routeOAuthConsentRequest } from "./routeOAuthConsentRequest";
import type { McpServer } from "../mcp/composeMcpServer";
import type { WebhookServices } from "../composition/composeWebhookServices";
import { routeConversationsRequest } from "./routeConversationsRequest";
import type { ConnectionsServices } from "../composition/composeConnectionsServices";
import type { MessagingServices } from "../composition/composeMessagingServices";
import type { BackgroundTasks } from "../http/BackgroundTasks";
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
  readonly connectionsServices: ConnectionsServices;
  /** Mensajes reales de WhatsApp (los avisos de uazapi los traen). */
  readonly messagingServices?: MessagingServices;
  /** Trabajo después de responder (procesar mensajes). */
  readonly background?: BackgroundTasks;
  /** Trabajador de la cola de tareas (`/internal/tasks/run`, con `CRON_SECRET`). */
  readonly tasks?: InternalTasksDependencies;
  /** `null` si no hay almacén de medios configurado. */
  readonly mediaServices: MediaServices | null;
  readonly authService: AuthService;
  readonly requestLogger: RequestLogger;
  /** Límite de peticiones (`limitRequests`). Ausente: sin límite (pruebas). */
  readonly rateLimiter?: RateLimiter;
  /** Webhooks de entrada (`null`: sin cifrado configurado). */
  readonly webhookServices?: WebhookServices | null;
  /** Servidor MCP para agentes de IA. */
  readonly mcpServer?: McpServer;
  /** Datos de la empresa (`/company`). Ausente: la ruta responde 503. */
  readonly companyServices?: CompanyServices;
  /** Equipo de la cuenta (`/team`). Ausente: la ruta responde 503. */
  readonly teamServices?: TeamServices;
  /** Invitaciones vistas por quien las recibe (`/invitations/:token`, sin sesión). */
  readonly invitationServices?: InvitationServices;
  /** Ventas y Productos (`/sales`, `/products`). Ausente: la ruta responde 503. */
  readonly salesServices?: SalesRoutes;
  /** CRM: embudos, tablero, seguimientos (`/crm`). Ausente: la ruta responde 503. */
  readonly crmServices?: CrmRoutes;
  /** Difusiones (`/broadcasts`). Ausente: la ruta responde 503. */
  readonly broadcastServices?: BroadcastRoutes;
  /** Grupos y comunidades (`/groups`) y el enlace público de sus campañas (`/g/<slug>`). */
  /** Ayuda y soporte (`/help`), y la documentación pública (`/llms.txt`, `/help/docs/<slug>.md`). */
  readonly helpServices?: HelpRoutes & { readonly docsBase: string };
  readonly groupServices?: GroupRoutes & { readonly link: Pick<LinkService, "click">; readonly activity: Pick<GroupActivity, "handle"> };
  /** Meta Ads (`/ads`) y el Dashboard (`/dashboard`). Ausente: responden 503. */
  readonly adsServices?: AdsModule;
}

export async function routeApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  dependencies: ApiRouterDependencies
): Promise<void> {
  const { services, meServices, contactsServices, integrationsServices, connectionsServices, mediaServices, authService, requestLogger } = dependencies;
  const method = request.method ?? "GET";

  if (url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  // Avisos de los proveedores de WhatsApp: los autentica el token de la instancia, no una sesión.
  if (await routeWhatsAppWebhooks(request, response, url, connectionsServices, dependencies.messagingServices, dependencies.background, dependencies.groupServices?.activity)) return;

  // Webhooks de entrada: los autoriza el secreto de su dirección, no una sesión.
  if (await routeInboundWebhook(request, response, url, dependencies.webhookServices, dependencies.background, dependencies.rateLimiter)) return;

  // Servidor MCP: lo autoriza el token de la credencial del agente, no una sesión.
  if (await routeMcp(request, response, url, dependencies.mcpServer, dependencies.rateLimiter)) return;

  // OAuth del servidor MCP (descubrimiento, registro y tokens): lo usa el agente, sin sesión.
  if (await routeOAuthPublic(request, response, url, dependencies.mcpServer, dependencies.rateLimiter)) return;
  // La vuelta del inicio de sesión de Meta: sin sesión, la cuenta sale del `state` firmado.
  if (await routeHelpDocs(request, response, url, dependencies.helpServices?.help, dependencies.helpServices?.docsBase ?? "")) return;
  if (await routeGroupLink(request, response, url, dependencies.groupServices?.link, dependencies.rateLimiter)) return;
  if (await routeAdsCallback(request, response, url, dependencies.adsServices?.connection, dependencies.adsServices?.appOrigin ?? "", dependencies.rateLimiter)) return;

  // Enlace de invitación al equipo: lo autoriza su secreto; quien lo abre puede no tener cuenta.
  if (await routeInvitationPublic(request, response, url, dependencies.invitationServices, dependencies.rateLimiter)) return;

  // Trabajador de la cola: lo autoriza `CRON_SECRET`, no una sesión.
  if (await routeInternalTasks(request, response, url, dependencies.tasks)) return;

  // Almacén local de medios (solo desarrollo): autoriza el permiso firmado, no la sesión.
  if (await routeLocalMediaRequest(request, response, url, mediaServices)) return;

  const principal = await authenticateRequest(request, authService);

  if (!principal) {
    requestLogger.logUnauthenticated(method, url.pathname, "unknown");
    // Solo cuentan los intentos sin sesión válida: frena credenciales falsas.
    await enforceRateLimit(dependencies.rateLimiter, `api:anon:${clientIp(request)}`, UNAUTHENTICATED_POLICY);
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
  await enforceRateLimit(dependencies.rateLimiter, `api:tenant:${requestContext.tenantId}`, TENANT_API_POLICY);
  recordLastSeen(dependencies.teamServices, dependencies.background, requestContext);

  if (url.pathname.startsWith("/contacts") || url.pathname.startsWith("/labels")) {
    if (await routeContactsRequest(request, response, url, contactsServices, requestContext)) return;
  }

  if (await routeCompanyRequest(request, response, url, dependencies.companyServices, requestContext)) return;
  if (await routeTeamRequest(request, response, url, dependencies.teamServices, requestContext)) return;
  if (await routeSalesRequest(request, response, url, dependencies.salesServices, requestContext)) return;
  if (await routeCrmRequest(request, response, url, dependencies.crmServices, requestContext)) return;
  if (await routeBroadcastsRequest(request, response, url, dependencies.broadcastServices, requestContext)) return;
  if (await routeGroupsRequest(request, response, url, dependencies.groupServices, requestContext)) return;
  if (await routeHelpRequest(request, response, url, dependencies.helpServices, requestContext)) return;
  if (await routeAdsRequest(request, response, url, dependencies.adsServices?.connection, requestContext)) return;
  if (await routeDashboardRequest(request, response, url, dependencies.adsServices?.dashboard, requestContext)) return;
  if (await routeIntegrationsRequest(request, response, url, integrationsServices, requestContext)) return;
  if (await routeWebhooksRequest(request, response, url, dependencies.webhookServices ?? null, requestContext)) return;
  if (await routeMcpCredentialsRequest(request, response, url, dependencies.mcpServer, requestContext)) return;
  if (await routeOAuthConsentRequest(request, response, url, dependencies.mcpServer, requestContext)) return;
  if (await routeConnectionsRequest(request, response, url, connectionsServices, requestContext)) return;
  if (dependencies.messagingServices && (await routeConversationsRequest(request, response, url, dependencies.messagingServices, requestContext))) return;
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
