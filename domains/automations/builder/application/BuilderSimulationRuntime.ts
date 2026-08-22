import type { FlowRegistry } from "../../../../flow-engine/registry/FlowRegistry";
import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { BuilderSimulationRequest } from "../../../../contracts/BuilderContracts";
import type { NodeExecutionResult } from "../../../../contracts/RuntimeContracts";
import type { FlowExecutor } from "../../../../flow-engine/ports/FlowExecutor";
import { convertBuilderSnapshotToRuntime } from "./convertBuilderSnapshotToRuntime";

// ---------------------------------------------------------------------------
// BuilderSimulationRuntime
//
// Ejecuta mensajes del simulador del builder contra un draft.
// No tiene infraestructura propia: recibe el ExecutionOrchestrator y el
// FlowRegistry ya ensamblados desde fuera (inyectados por la factory).
//
// El FlowRegistry aquí es aislado para esta instancia de simulación:
// no es el registry de producción. Cada vez que simulate() se llama,
// se publica el draft actual en el registry aislado.
// ---------------------------------------------------------------------------

export class BuilderSimulationRuntime {
  public constructor(
    private readonly tenantId: string,
    private readonly orchestrator: FlowExecutor,
    private readonly flowRegistry: FlowRegistry
  ) {}

  public simulate(
    snapshot: BuilderFlowSnapshot,
    request: BuilderSimulationRequest
  ): NodeExecutionResult {
    // Publicar el draft actual en el registry aislado de simulación.
    // Esto actualiza la versión activa del runtime de simulación
    // para que el orchestrator use el draft más reciente.
    this.flowRegistry.publish(convertBuilderSnapshotToRuntime(snapshot, this.tenantId));

    return this.orchestrator.handle({
      tenantId: this.tenantId,
      flowKey: snapshot.flow.key,
      channel: "builder-simulator",
      conversationKey: request.conversationKey,
      userKey: request.userKey,
      messageId: `${request.conversationKey}-${Date.now()}`,
      payload: { text: request.message },
      receivedAt: new Date().toISOString()
    });
  }
}
