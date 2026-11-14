import type { SalesLedger } from "../../../flow-engine/ports/SalesLedger";
import type { ContactFieldCatalog } from "../../../flow-engine/ports/ContactFieldCatalog";
import type { BusinessDataReader } from "../../../flow-engine/ports/BusinessDataReader";
import type { ApiConfig } from "../config/loadApiConfig";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import type { DocumentTextReader } from "../../../flow-engine/ports/DocumentTextReader";
import type { ContactsServices } from "./composeContactsServices";
import type { IntegrationsServices } from "./composeIntegrationsServices";
import { composeNodeRuntime } from "./composeNodeRuntime";
import { SafeHttpRequester } from "../../../infrastructure/http/SafeHttpRequester";
import { SqlRoundRobinCounter } from "../../../infrastructure/persistence/sql/SqlRoundRobinCounter";
import { SqlReceiptRegistry } from "../../../infrastructure/persistence/sql/SqlReceiptRegistry";
import { SqlConversationFacts } from "../../../infrastructure/persistence/sql/SqlConversationFacts";
import { SqlSessionRepository } from "../../../infrastructure/persistence/sql/SqlSessionRepository";
import { SessionService } from "../../../domains/sessions/application/SessionService";
import { ContextService } from "../../../domains/sessions/application/ContextService";
import { AnalyticsService } from "../../../domains/analytics/application/AnalyticsService";
import { SavedFlowRegistry } from "../../../domains/automations/runtime/SavedFlowRegistry";
import { ExecutionLoop } from "../../../flow-engine/execution/ExecutionLoop";
import { ExecutionOrchestrator } from "../../../flow-engine/execution/ExecutionOrchestrator";
import { ExecutionEventTracker } from "../../../flow-engine/execution/ExecutionEventTracker";
import { EdgeEvaluator } from "../../../flow-engine/edges/EdgeEvaluator";
import { SqlTenantResolver } from "../../../infrastructure/persistence/sql/SqlTenantResolver";

// ---------------------------------------------------------------------------
// El motor de flujos de PRODUCCIÓN: sesiones y flujos guardados en
// PostgreSQL, contactos, turnos y comprobantes reales, e IA, píxel e
// integraciones de la cuenta. Lo usa la mensajería (`composeMessagingServices`).
//
// Distinto de la simulación del builder, que corre todo en memoria y aislado.
// ---------------------------------------------------------------------------

export interface ProductionEngineDependencies {
  readonly config: ApiConfig;
  readonly sql: SqlClient;
  readonly workspaces: BuilderWorkspaceRepository;
  readonly contacts: ContactsServices;
  readonly integrations: IntegrationsServices;
  readonly documents: DocumentTextReader;
  readonly sales: SalesLedger;
  /** Campos del cliente de la cuenta (su tipo). Ausente: ninguna clave tiene tipo. */
  readonly fieldCatalog?: ContactFieldCatalog;
  /** Datos del negocio (`{g_…}`), leídos una vez por turno. Ausente: el motor no los conoce. */
  readonly businessValues?: BusinessDataReader;
}

export function composeProductionEngine(deps: ProductionEngineDependencies) {
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
    receipts: new SqlReceiptRegistry(deps.sql),
    sales: deps.sales,
    ...(deps.fieldCatalog ? { fields: deps.fieldCatalog } : {})
  });

  // La zona horaria de cada empresa (la de Empresa; si no eligió una, la de la plataforma).
  const tenants = new SqlTenantResolver(deps.sql, deps.config.defaultTimezone);
  const engine = new ExecutionOrchestrator(
    tenants,
    new SavedFlowRegistry(deps.workspaces),
    sessions,
    new ExecutionLoop(sessions, new ContextService(), nodeRuntime, new EdgeEvaluator(), new ExecutionEventTracker(new AnalyticsService())),
    deps.businessValues,
    // `{attendant_name}`, `{instance_name}`, `{instance_number}`.
    new SqlConversationFacts(deps.sql)
  );

  return { engine, sessionRepository, tenants };
}
