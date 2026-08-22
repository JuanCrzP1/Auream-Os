import type { BuilderSimulationRequest, PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { BuilderSimulationRuntime } from "./BuilderSimulationRuntime";
import type { SimulationRuntimeFactory } from "./ports/SimulationRuntimeFactory";

// ---------------------------------------------------------------------------
// SimulateDraftService
//
// Gestiona instancias de simulación por tenant+flow.
// Cada instancia tiene su propio stack de estado aislado (SessionService,
// ConversationService, AnalyticsService, FlowRegistry).
//
// Eviction simple FIFO: cuando se supera MAX_CACHED_RUNTIMES se elimina
// el runtime más antiguo (insertion order del Map).
// En producción esto se reemplaza por TTL en Redis.
// ---------------------------------------------------------------------------

export class SimulateDraftService {
  private readonly runtimes = new Map<string, BuilderSimulationRuntime>();
  private static readonly MAX_CACHED_RUNTIMES = 50;

  public constructor(private readonly runtimeFactory: SimulationRuntimeFactory) {}

  public simulate(workspace: PersistedBuilderWorkspace, request: BuilderSimulationRequest) {
    const key = `${workspace.tenantId}:${workspace.flowKey}`;
    let runtime = this.runtimes.get(key);

    if (!runtime) {
      if (this.runtimes.size >= SimulateDraftService.MAX_CACHED_RUNTIMES) {
        const oldestKey = this.runtimes.keys().next().value;
        if (oldestKey !== undefined) {
          this.runtimes.delete(oldestKey);
        }
      }
      runtime = this.runtimeFactory.create(workspace.tenantId);
      this.runtimes.set(key, runtime);
    }

    return runtime.simulate(workspace.draft, request);
  }
}