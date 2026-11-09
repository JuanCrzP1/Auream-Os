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
import { TesseractDocumentReader } from "../../../infrastructure/documents/TesseractDocumentReader";
import { createBackgroundTasks } from "../http/BackgroundTasks";
import { StructuredLogger } from "../../../platform/observability/logging/StructuredLogger";
import { RequestLogger } from "../../../platform/observability/logging/RequestLogger";
import { ErrorLogger } from "../../../platform/observability/logging/ErrorLogger";
import { createApiRequestListener, type ApiRequestListener } from "./createApiServer";

// ---------------------------------------------------------------------------
// composeApiApplication — lee la configuración del entorno y compone TODA la
// API una vez por proceso. La usan `main.ts` (servidor que escucha un puerto)
// y la función de Vercel (`api/index.ts`): una sola composición, dos formas
// de servirla.
//
// Lanza `ApiConfigError` si falta algo obligatorio: quien llama decide cómo
// fallar (salir del proceso, o responder 500 sin filtrar detalles).
// ---------------------------------------------------------------------------

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
  const tenancy = composeTenancyServices(databaseConfig);
  const integrations = composeIntegrationsServices(tenancy.sqlClient, config.credentialsKeyRing, undefined, { metaGraphVersion: config.metaGraphVersion });
  // Un solo lector de comprobantes por instancia (simulación, «Probar» y flujos reales).
  const documents = new TesseractDocumentReader();
  const services = composeBuilderServices(config, tenancy.sqlClient, integrations.aiGateway, integrations.conversionTracker, documents);
  const contactsServices = composeContactsServices(tenancy.sqlClient);
  const connectionsServices = composeConnectionsServices(tenancy.sqlClient, {
    keyRing: config.credentialsKeyRing,
    uazapi: config.uazapi,
    webhookBaseUrl: config.whatsappWebhookBaseUrl
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
    // Un despertador que no se pudo armar: lo cubren el próximo mensaje, la próxima ronda y el barrido diario.
    (error) => logger.warn("tasks.alarm_failed", { error: error instanceof Error ? error.message : String(error) })
  );
  const messagingServices = composeMessagingServices({
    config,
    sql: tenancy.sqlClient,
    // Pool aparte para los candados por conversación: nunca compite con el trabajo.
    lockSql: createSqlClient(databaseConfig.connectionString, { max: 4, idleTimeoutMs: databaseConfig.idleTimeoutMs }),
    workspaces: services.workspaceRepository,
    contacts: contactsServices,
    integrations,
    connections: connectionsServices,
    documents,
    scheduler: scheduling.scheduler
  });
  const runner = scheduling.attachHandlers([new FlowTimerTaskHandler(messagingServices.timers)]);

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
      }
    },
    mediaServices: composeMediaServices(config, tenancy.sqlClient),
    meServices: {
      membershipRepository: tenancy.membershipRepository,
      onboarding: tenancy.onboarding
    },
    authService: composeAuthService(config, authConfig),
    requestLogger: new RequestLogger(logger),
    errorLogger
  });

  return { config, listener, tasks: runner };
}
