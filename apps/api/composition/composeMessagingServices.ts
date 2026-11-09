import type { ApiConfig } from "../config/loadApiConfig";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import type { DocumentTextReader } from "../../../flow-engine/ports/DocumentTextReader";
import type { ContactsServices } from "./composeContactsServices";
import type { IntegrationsServices } from "./composeIntegrationsServices";
import type { ConnectionsServices } from "./composeConnectionsServices";
import { composeNodeRuntime } from "./composeNodeRuntime";
import { SafeHttpRequester } from "../../../infrastructure/http/SafeHttpRequester";
import { SqlRoundRobinCounter } from "../../../infrastructure/persistence/sql/SqlRoundRobinCounter";
import { SqlReceiptRegistry } from "../../../infrastructure/persistence/sql/SqlReceiptRegistry";
import { SqlSessionRepository } from "../../../infrastructure/persistence/sql/SqlSessionRepository";
import { SqlInboundMessageLog } from "../../../infrastructure/persistence/sql/SqlInboundMessageLog";
import { SqlConversationLock } from "../../../infrastructure/persistence/sql/SqlConversationLock";
import { SessionService } from "../../../domains/sessions/application/SessionService";
import { ContextService } from "../../../domains/sessions/application/ContextService";
import { AnalyticsService } from "../../../domains/analytics/application/AnalyticsService";
import { SavedFlowRegistry } from "../../../domains/automations/runtime/SavedFlowRegistry";
import { ExecutionLoop } from "../../../flow-engine/execution/ExecutionLoop";
import { ExecutionOrchestrator } from "../../../flow-engine/execution/ExecutionOrchestrator";
import { ExecutionEventTracker } from "../../../flow-engine/execution/ExecutionEventTracker";
import { EdgeEvaluator } from "../../../flow-engine/edges/EdgeEvaluator";
import { DefaultTimezoneTenantResolver } from "../../../platform/tenancy/application/TenantResolver";
import { HandleInboundMessageService } from "../../../domains/messaging/application/HandleInboundMessageService";
import { ConnectionTriggerRouter, DirectoryInboundContacts, SessionLiveSessions } from "../../../domains/messaging/application/adapters";

// ---------------------------------------------------------------------------
// composeMessagingServices — los mensajes reales de WhatsApp de punta a punta:
// el motor de PRODUCCIÓN (sesiones y flujos guardados en PostgreSQL, contactos,
// turnos y comprobantes reales, IA/píxel/integraciones de la cuenta) y la
// mensajería entrante que lo usa.
//
// Distinto de la simulación del builder, que corre todo en memoria y aislado.
// ---------------------------------------------------------------------------

export interface MessagingServices {
  readonly inbound: HandleInboundMessageService;
}

export interface MessagingDependencies {
  readonly config: ApiConfig;
  readonly sql: SqlClient;
  /** Pool aparte para los candados por conversación (nunca compite con el trabajo). */
  readonly lockSql: SqlClient;
  readonly workspaces: BuilderWorkspaceRepository;
  readonly contacts: ContactsServices;
  readonly integrations: IntegrationsServices;
  readonly connections: ConnectionsServices;
  readonly documents: DocumentTextReader;
}

export function composeMessagingServices(deps: MessagingDependencies): MessagingServices {
  const http = new SafeHttpRequester({ allowPrivateNetworks: deps.config.integrationsAllowPrivateNetwork });
  const sessionRepository = new SqlSessionRepository(deps.sql);
  const sessions = new SessionService(sessionRepository);

  const nodeRuntime = composeNodeRuntime({
    roundRobin: new SqlRoundRobinCounter(deps.sql),
    contacts: deps.contacts.directory,
    http,
    ai: deps.integrations.aiGateway,
    conversions: deps.integrations.conversionTracker,
    media: http,
    documents: deps.documents,
    receipts: new SqlReceiptRegistry(deps.sql)
  });

  const engine = new ExecutionOrchestrator(
    new DefaultTimezoneTenantResolver(deps.config.defaultTimezone),
    new SavedFlowRegistry(deps.workspaces),
    sessions,
    new ExecutionLoop(sessions, new ContextService(), nodeRuntime, new EdgeEvaluator(), new ExecutionEventTracker(new AnalyticsService()))
  );

  return {
    inbound: new HandleInboundMessageService(
      new SqlInboundMessageLog(deps.sql),
      new SqlConversationLock(deps.lockSql),
      new DirectoryInboundContacts(deps.contacts.directory),
      new SessionLiveSessions(sessionRepository, deps.connections.flows),
      new ConnectionTriggerRouter(deps.connections.triggers),
      engine,
      deps.connections.channel
    )
  };
}
