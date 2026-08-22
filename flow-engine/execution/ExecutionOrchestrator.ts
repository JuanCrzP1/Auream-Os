import type { FlowSnapshot } from "../../contracts/FlowSnapshot";
import type { FlowRegistry } from "../registry/FlowRegistry";
import type { InboundEnvelope, NodeExecutionResult } from "../../contracts/RuntimeContracts";
import type { Session } from "../../contracts/RuntimeContracts";

import type { SessionStore, TenantContextResolver } from "../ports/RuntimePorts";
import { ExecutionLoop } from "./ExecutionLoop";

// ---------------------------------------------------------------------------
// ExecutionOrchestrator
//
// Responsabilidad única: resolver el contexto de ejecución (tenant, snapshot
// publicado y sesión) y delegar el recorrido del grafo en el ExecutionLoop.
//
// No conoce conversaciones: el inbox operacional es responsabilidad del futuro
// dominio `conversations`, no del motor.
// ---------------------------------------------------------------------------

export class ExecutionOrchestrator {
  public constructor(
    private readonly tenantResolver: TenantContextResolver,
    private readonly flowRegistry: FlowRegistry,
    private readonly sessionService: SessionStore,
    private readonly executionLoop: ExecutionLoop
  ) {}

  public handle(envelope: InboundEnvelope): NodeExecutionResult {
    const tenant = this.tenantResolver.resolve(envelope.tenantId);
    const publishedSnapshot = this.flowRegistry.getPublishedSnapshot(tenant.tenantId, envelope.flowKey);

    const initialSession = this.sessionService.getOrCreateActive(
      tenant.tenantId,
      envelope,
      publishedSnapshot
    );

    const snapshot = this.resolveSnapshot(initialSession, publishedSnapshot);
    return this.executionLoop.run(snapshot, initialSession, envelope);
  }

  private resolveSnapshot(session: Session, publishedSnapshot: FlowSnapshot): FlowSnapshot {
    if (session.flowVersionId === publishedSnapshot.version.id) {
      return publishedSnapshot;
    }

    return this.flowRegistry.getSnapshotByVersion(
      session.tenantId,
      session.flowId,
      session.flowVersionId
    );
  }
}
