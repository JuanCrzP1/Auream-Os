import type { FlowSnapshot } from "../../contracts/FlowSnapshot";
import type { FlowRegistry } from "../registry/FlowRegistry";
import { type InboundEnvelope } from "../../contracts/RuntimeContracts";
import { timerOf, type FlowRunResult } from "../../contracts/FlowTimerContracts";
import type { Session } from "../../contracts/RuntimeContracts";

import type { BusinessDataReader } from "../ports/BusinessDataReader";
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
    private readonly executionLoop: ExecutionLoop,
    /** Los Datos del negocio (`{g_…}`), una vez por turno. Ausente: el motor no los conoce. */
    private readonly business?: BusinessDataReader
  ) {}

  public async handle(envelope: InboundEnvelope): Promise<FlowRunResult> {
    const tenant = await this.tenantResolver.resolve(envelope.tenantId);
    const publishedSnapshot = await this.flowRegistry.getPublishedSnapshot(tenant.tenantId, envelope.flowKey);

    // Un despertador nunca empieza un recorrido: si la sesión ya no sigue en
    // ese flujo (terminó, se envió otro flujo a mano…), no hay nada que hacer.
    const timer = timerOf(envelope);
    const initialSession = timer
      ? await this.sessionService.findLive(tenant.tenantId, envelope.conversationKey, publishedSnapshot.flow.id)
      : await this.sessionService.getOrCreateActive(tenant.tenantId, envelope, publishedSnapshot);
    if (!initialSession) {
      return { executionStatus: "completed", outputMessages: [], contextPatch: {}, nodeResult: {}, domainEvents: [`timer_stale:no_live_session`], untouched: true };
    }

    const snapshot = await this.resolveSnapshot(initialSession, publishedSnapshot);
    // Un fallo al leerlos no tumba el turno: los textos quedan con su valor por defecto.
    const business = this.business ? await this.business.values(tenant.tenantId).catch(() => ({})) : undefined;
    return this.executionLoop.run(snapshot, initialSession, envelope, { timezone: tenant.timezone, ...(business ? { business } : {}) });
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
