import { loadApiConfig, type ApiConfig } from "../config/loadApiConfig";
import { loadDatabaseConfig } from "../config/loadDatabaseConfig";
import { loadNeonAuthConfig } from "../config/loadNeonAuthConfig";
import { composeAuthService } from "../composition/composeAuthService";
import { composeBuilderServices } from "../composition/composeBuilderServices";
import { composeTenancyServices } from "../composition/composeTenancyServices";
import { composeContactsServices } from "../composition/composeContactsServices";
import { composeIntegrationsServices } from "../composition/composeIntegrationsServices";
import { composeConnectionsServices } from "../composition/composeConnectionsServices";
import { composeMediaServices } from "../composition/composeMediaServices";
import { composeMessagingServices } from "../composition/composeMessagingServices";
import { composeSchedulingServices } from "../composition/composeSchedulingServices";
import { FlowTimerTaskHandler } from "../composition/flowTimerAdapters";
import type { TaskRunner } from "../../../domains/scheduling/application/TaskRunner";
import { createSqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlRateLimiter } from "../../../infrastructure/persistence/sql/SqlRateLimiter";
import { SqlFlowTurnJournal } from "../../../infrastructure/persistence/sql/SqlFlowTurnJournal";
import { composeTurnJournal } from "../composition/composeTurnJournal";
import { composeWebhookServices } from "../composition/composeWebhookServices";
import { composeMcpServer } from "../mcp/composeMcpServer";
import { TesseractDocumentReader } from "../../../infrastructure/documents/TesseractDocumentReader";
import { createBackgroundTasks } from "../http/BackgroundTasks";
import { StructuredLogger } from "../../../platform/observability/logging/StructuredLogger";
import { RequestLogger } from "../../../platform/observability/logging/RequestLogger";
import { ErrorLogger } from "../../../platform/observability/logging/ErrorLogger";
import { createApiRequestListener, type ApiRequestListener } from "./createApiServer";
import { wakeTasksOnTraffic } from "./wakeTasksOnTraffic";
import { composeAccountServices } from "../composition/composeAccountServices";
import { composeTeamServices } from "../composition/composeTeamServices";
import { composeSalesServices } from "../composition/composeSalesServices";
import { composeCrmServices } from "../composition/composeCrmServices";
import { composeAdsServices } from "../composition/composeAdsServices";
import { CrmEventsRelay } from "../composition/CrmEventsRelay";
import { composeBroadcastServices } from "../composition/composeBroadcastServices";
import { composeGroupServices } from "../composition/composeGroupServices";
import { composeHelpServices } from "../composition/composeHelpServices";
import { composeNotificationServices } from "../composition/composeNotificationServices";
import { composeQuickReplyServices } from "../composition/composeQuickReplyServices";
import { composeContactNoteServices } from "../composition/composeContactNoteServices";
import type { InboundListener } from "../composition/composeMessagingServices";
import { StageLabelRules } from "../../../domains/crm/application/StageLabelRules";
import { SqlCrmPipelineRepository } from "../../../infrastructure/persistence/sql/SqlCrmPipelineRepository";

// ---------------------------------------------------------------------------
// composeApiApplication — lee la configuración del entorno y compone TODA la
// API una vez por proceso. La usan `main.ts` (servidor que escucha un puerto)
// y la función de Vercel (`api/index.ts`): una sola composición, dos formas
// de servirla.
//
// Lanza `ApiConfigError` si falta algo obligatorio: quien llama decide cómo
// fallar (salir del proceso, o responder 500 sin filtrar detalles).
// ---------------------------------------------------------------------------

/** Una tarea que corre más tarde que esto queda avisada en el registro (`tasks.late`). */
const LATE_TASK_WARNING_MS = 60_000;

/**
 * Candados por conversación a la vez en una instancia. Cada turno ocupa uno
 * mientras dura (con sus pausas): cabe lo que el trabajador corre a la vez
 * (`DEFAULT_RUNNER_OPTIONS.concurrency`) más los mensajes que van llegando.
 */
const CONVERSATION_LOCKS_PER_INSTANCE = 20;

export interface ApiApplication {
  readonly config: ApiConfig;
  readonly listener: ApiRequestListener;
  /** Trabajador de la cola de tareas (lo despiertan el endpoint interno o `apps/worker`). */
  readonly tasks: TaskRunner;
}

export function composeApiApplication(env: NodeJS.ProcessEnv = process.env): ApiApplication {
  const config = loadApiConfig(env);
  const databaseConfig = loadDatabaseConfig(env);
  const authConfig = loadNeonAuthConfig(env);

  const logger = new StructuredLogger({ service: "bots-ai-platform-api" });
  // Neon cierra conexiones quietas: se anota y el grupo abre otra, sin tumbar la API.
  const onIdleError = (error: Error) => logger.warn("db.idle_connection_lost", { error: error.message });
  const tenancy = composeTenancyServices(databaseConfig, onIdleError);
  const integrations = composeIntegrationsServices(tenancy.sqlClient, config.credentialsKeyRing, undefined, { metaGraphVersion: config.metaGraphVersion });
  // Un solo lector de comprobantes por instancia (simulación, «Probar» y flujos reales).
  const documents = new TesseractDocumentReader();
  // Límite de peticiones compartido por todas las instancias (Neon). Si la base falla, deja pasar y lo avisa.
  const rateLimiter = new SqlRateLimiter(tenancy.sqlClient, undefined, (error) => logger.warn("rate_limit.store_failed", { error: error instanceof Error ? error.message : String(error) }));
  // El CRM escucha a Contactos (las etapas son etiquetas) y a Ventas (quien compra pasa a «Pagó»).
  // Se compone después de ellos porque usa sus servicios: sus avisos pasan por este relevo.
  const crmEvents = new CrmEventsRelay();
  const crmError = (error: unknown, context: Record<string, unknown> = {}) =>
    logger.warn("crm.event_failed", { ...context, error: error instanceof Error ? error.message : String(error) });
  // Ventas y Productos: el bloque Registrar venta guarda en los flujos reales y calcula sin guardar en la simulación.
  const sales = composeSalesServices(config, tenancy.sqlClient, crmEvents);
  const services = composeBuilderServices(config, tenancy.sqlClient, integrations.aiGateway, integrations.conversionTracker, documents, rateLimiter, sales.preview);
  const contactsServices = composeContactsServices(tenancy.sqlClient, {
    // Un cliente está en una sola etapa por embudo, venga la etiqueta de donde venga.
    groups: new StageLabelRules(new SqlCrmPipelineRepository(tenancy.sqlClient)),
    events: crmEvents,
    onError: crmError
  });
  const crm = composeCrmServices({
    config,
    sql: tenancy.sqlClient,
    contacts: contactsServices.repository,
    labels: contactsServices.labelRepository,
    products: sales.products,
    onError: crmError
  });
  crmEvents.attach(crm.tracker);
  const connectionsServices = composeConnectionsServices(tenancy.sqlClient, {
    keyRing: config.credentialsKeyRing,
    uazapi: config.uazapi,
    webhookBaseUrl: config.whatsappWebhookBaseUrl,
    rateLimiter
  });
  const errorLogger = new ErrorLogger(logger);
  const background = createBackgroundTasks((error) => errorLogger.log(error instanceof Error ? error : new Error(String(error)), {}));
  // Cola de tareas (FASE C6): primero el programador (lo usan los flujos), después el trabajador.
  const scheduling = composeSchedulingServices(
    config,
    tenancy.sqlClient,
    background,
    (task, error) =>
      logger.warn("tasks.attempt_failed", {
        taskId: task.id,
        kind: task.kind,
        tenantId: task.tenantId,
        attempt: task.attempts,
        error: error instanceof Error ? error.message : String(error)
      }),
    // Un despertador que no se pudo armar: lo cubren el tráfico de la app, la próxima ronda y la revisión cada 15 min.
    (error) => logger.warn("tasks.alarm_failed", { error: error instanceof Error ? error.message : String(error) })
  );
  // Difusiones oye los mensajes entrantes («SALIR»), pero se arma después de Mensajería.
  const inboundListeners: { current: InboundListener[] } = { current: [] };
  const messagingServices = composeMessagingServices({
    config,
    sql: tenancy.sqlClient,
    // Pool aparte para los candados por conversación: nunca compite con el trabajo.
    lockSql: createSqlClient(databaseConfig.connectionString, { max: CONVERSATION_LOCKS_PER_INSTANCE, idleTimeoutMs: databaseConfig.idleTimeoutMs, onIdleError }),
    workspaces: services.workspaceRepository,
    contacts: contactsServices,
    integrations,
    connections: connectionsServices,
    documents,
    scheduler: scheduling.scheduler,
    journal: composeTurnJournal(new SqlFlowTurnJournal(tenancy.sqlClient), logger),
    sales: sales.ledger,
    inboundListeners,
    dealOwners: crm.ownerClaims,
    onContactWrote: (tenantId, contactId) => crm.tracker.contactWrote(tenantId, contactId)
  });
  // Meta Ads (se sincroniza en la cola de tareas) y el Dashboard.
  const ads = composeAdsServices(config, tenancy.sqlClient, scheduling.scheduler, (error, context) =>
    logger.warn("ads.sync_failed", { ...context, error: error instanceof Error ? error.message : String(error) })
  );
  // Difusiones: envía por Mensajería, a su ritmo, en la cola de tareas.
  const broadcasts = composeBroadcastServices({
    config,
    sql: tenancy.sqlClient,
    scheduler: scheduling.scheduler,
    outreach: messagingServices.outreach,
    connections: connectionsServices,
    onError: (error, context) => logger.warn("broadcasts.failed", { ...context, error: error instanceof Error ? error.message : String(error) })
  });
  inboundListeners.current.push(broadcasts.optOuts);
  // Grupos: campañas con enlace único, envíos a grupos y lo que vende cada uno.
  const groups = composeGroupServices({
    config,
    sql: tenancy.sqlClient,
    scheduler: scheduling.scheduler,
    connections: connectionsServices,
    contacts: contactsServices.directory
  });
  const runner = scheduling.attachHandlers([
    new FlowTimerTaskHandler(messagingServices.timers),
    ...(ads.syncHandler ? [ads.syncHandler] : []),
    ...broadcasts.handlers,
    ...groups.handlers
  ]);
  // Medios de los bloques; el mismo almacén guarda las fotos de perfil y los logos (Mi perfil, Empresa).
  const mediaServices = composeMediaServices(config, tenancy.sqlClient, rateLimiter);
  const accountServices = composeAccountServices(config, tenancy.sqlClient, mediaServices?.storage ?? null, rateLimiter);
  const team = composeTeamServices(tenancy.sqlClient);

  // Ayuda: artículos del repositorio (también para el MCP y llms.txt), tutoriales y soporte.
  const help = composeHelpServices(tenancy.sqlClient);

  const listener = createApiRequestListener(config, {
    services,
    contactsServices,
    integrationsServices: integrations,
    connectionsServices,
    messagingServices,
    background,
    tasks: {
      runner,
      cronSecret: config.tasks.cronSecret,
      budgetMs: config.tasks.runnerBudgetMs,
      background,
      chain: { horizonMs: config.tasks.chainHorizonMs, continueIfSoon: (horizonMs) => scheduling.scheduler.continueIfSoon(horizonMs) },
      armNext: () => scheduling.scheduler.armNext(),
      onReport: (report) => {
        if (report.claimed > 0) logger.info("tasks.round", { ...report });
        // Más de un minuto tarde: algo no la despertó a su hora (revisar los despertadores).
        if (report.maxLateMs > LATE_TASK_WARNING_MS) logger.warn("tasks.late", { maxLateMs: report.maxLateMs, claimed: report.claimed });
      }
    },
    mediaServices,
    companyServices: accountServices.company,
    teamServices: team.team,
    invitationServices: team.invitations,
    salesServices: { products: sales.products, sales: sales.sales, insights: sales.insights },
    crmServices: crm.routes,
    broadcastServices: { broadcasts: broadcasts.broadcasts, audiences: broadcasts.audiences },
    groupServices: groups,
    helpServices: { ...help, docsBase: config.helpDocsBase },
    notificationServices: composeNotificationServices(tenancy.sqlClient, config.defaultTimezone),
    quickReplyServices: composeQuickReplyServices(tenancy.sqlClient),
    contactNoteServices: composeContactNoteServices(tenancy.sqlClient),
    adsServices: ads,
    webhookServices: composeWebhookServices({ config, sql: tenancy.sqlClient, contacts: contactsServices, connections: connectionsServices, messaging: messagingServices }),
    mcpServer: composeMcpServer({
      config,
      sql: tenancy.sqlClient,
      builder: services,
      integrations,
      contacts: contactsServices,
      connections: connectionsServices,
      messaging: messagingServices,
      products: sales.products,
      help: help.help,
      // Cada acción de un agente queda en el registro (sin sus datos).
      onToolCall: (access, report) => logger.info("mcp.tool_call", { tenantId: access.tenantId, credentialId: access.credentialId, ...report })
    }),
    rateLimiter,
    meServices: {
      membershipRepository: tenancy.membershipRepository,
      onboarding: tenancy.onboarding,
      profiles: accountServices.profiles,
      invitations: team.invitations
    },
    authService: composeAuthService(config, authConfig),
    requestLogger: new RequestLogger(logger),
    errorLogger
  });

  // Red de seguridad de los despertadores: el tráfico de la API también
  // despierta la cola (ver `wakeTasksOnTraffic`).
  const wakeTasks = wakeTasksOnTraffic(scheduling.scheduler, background);

  return {
    config,
    listener: async (request, response) => {
      wakeTasks(request.url);
      await listener(request, response);
    },
    tasks: runner
  };
}
