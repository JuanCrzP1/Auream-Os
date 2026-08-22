import { AnalyticsService } from "../../../domains/analytics/application/AnalyticsService";
import { EdgeEvaluator } from "../../../flow-engine/edges/EdgeEvaluator";
import { ExecutionEventTracker } from "../../../flow-engine/execution/ExecutionEventTracker";
import { ExecutionLoop } from "../../../flow-engine/execution/ExecutionLoop";
import { ExecutionOrchestrator } from "../../../flow-engine/execution/ExecutionOrchestrator";
import type { NodeRuntime } from "../../../flow-engine/nodes/NodeRuntime";
import { ContextService } from "../../../domains/sessions/application/ContextService";
import { SessionService } from "../../../domains/sessions/application/SessionService";
import { StaticTenantResolver } from "../../../platform/tenancy/application/TenantResolver";
import { InMemoryFlowRegistry } from "../../../infrastructure/persistence/memory/InMemoryFlowRegistry";
import { InMemorySessionRepository } from "../../../infrastructure/persistence/memory/InMemorySessionRepository";
import type { SimulationRuntimeFactory } from "../../../domains/automations/builder/application/ports/SimulationRuntimeFactory";
import { BuilderSimulationRuntime } from "../../../domains/automations/builder/application/BuilderSimulationRuntime";

// ---------------------------------------------------------------------------
// BuilderSimulationRuntimeFactory
//
// Ensambla un BuilderSimulationRuntime aislado para la simulación de drafts.
// Cada instancia retornada tiene su propio stack de estado (SessionService,
// AnalyticsService, FlowRegistry) — completamente aislado entre simulaciones.
//
// El NodeRuntime (con sus handlers) se inyecta desde afuera: se comparte
// la configuración de nodos sin duplicar la definición de handlers.
//
// Los límites de tenant son los de la simulación, no los del plan contratado:
// el builder simula un draft, no ejecuta tráfico real.
// ---------------------------------------------------------------------------

const SIMULATION_TENANT_LIMITS = {
  maxActiveSessions: 2000,
  maxWebhookRetries: 3
} as const;

export class BuilderSimulationRuntimeFactory implements SimulationRuntimeFactory {
  public constructor(private readonly nodeRuntime: NodeRuntime) {}

  public create(tenantId: string): BuilderSimulationRuntime {
    const flowRegistry = new InMemoryFlowRegistry();
    const sessionService = new SessionService(new InMemorySessionRepository());
    const eventTracker = new ExecutionEventTracker(new AnalyticsService());

    const executionLoop = new ExecutionLoop(
      sessionService,
      new ContextService(),
      this.nodeRuntime,
      new EdgeEvaluator(),
      eventTracker
    );

    const orchestrator = new ExecutionOrchestrator(
      new StaticTenantResolver({
        [tenantId]: {
          tenantId,
          tenantKey: tenantId,
          limits: SIMULATION_TENANT_LIMITS
        }
      }),
      flowRegistry,
      sessionService,
      executionLoop
    );

    return new BuilderSimulationRuntime(tenantId, orchestrator, flowRegistry);
  }
}
