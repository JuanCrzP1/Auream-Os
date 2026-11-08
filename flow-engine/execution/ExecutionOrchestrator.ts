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

  public async handle(envelope: InboundEnvelope): Promise<NodeExecutionResult> {
    const tenant = await this.tenantResolver.resolve(envelope.tenantId);
    const publishedSnapshot = await this.flowRegistry.getPublishedSnapshot(tenant.tenantId, envelope.flowKey);

    const initialSession = await this.sessionService.getOrCreateActive(
      tenant.tenantId,
      envelope,
      publishedSnapshot
    );

    const snapshot = await this.resolveSnapshot(initialSession, publishedSnapshot);
    return this.executionLoop.run(snapshot, initialSession, envelope, { timezone: tenant.timezone });
  }

  private async resolveSnapshot(session: Session, publishedSnapshot: FlowSnapshot): Promise<FlowSnapshot> {
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
