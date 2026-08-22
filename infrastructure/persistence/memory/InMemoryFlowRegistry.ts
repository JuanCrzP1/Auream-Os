import type { FlowRegistry, ActiveFlowVersion } from "../../../flow-engine/registry/FlowRegistry";
import type { FlowSnapshot } from "../../../contracts/FlowSnapshot";

// ---------------------------------------------------------------------------
// InMemoryFlowRegistry
//
// Implementación in-memory del FlowRegistry.
// Destinada a desarrollo y tests. En producción se reemplaza por
// PostgresFlowRegistry o RedisFlowRegistry sin cambiar el contrato.
//
// Tenant isolation:
//   snapshotsByVersion usa clave compuesta `${tenantId}:${flowId}:${versionId}`.
//   Imposible acceder a datos de otro tenant con solo el versionId.
//
// Versión activa:
//   activeVersionsByFlow almacena la versión que el runtime usa para
//   nuevas sesiones. Se actualiza en cada publish() automáticamente.
//   publish() puede redefinirse como pipeline explícito en el futuro.
// ---------------------------------------------------------------------------

export class InMemoryFlowRegistry implements FlowRegistry {
  // Clave: `${tenantId}:${flowId}:${versionId}` — aislamiento multi-tenant garantizado.
  private readonly snapshotsByVersion = new Map<string, FlowSnapshot>();

  // Clave: `${tenantId}:${flowKey}` — apunta al versionId activo.
  private readonly publishedByTenantAndKey = new Map<string, string>();

  // Versiones activas por tenant+flow. El runtime consulta esto para nuevas sesiones.
  private readonly activeVersionsByFlow = new Map<string, ActiveFlowVersion>();

  public getPublishedSnapshot(tenantId: string, flowKey: string): FlowSnapshot {
    const publishedVersionId = this.publishedByTenantAndKey.get(`${tenantId}:${flowKey}`);

    if (!publishedVersionId) {
      throw new Error(`No existe flow publicado para ${tenantId}:${flowKey}`);
    }

    const snapshot = this.snapshotsByVersion.get(publishedVersionId);

    if (!snapshot) {
      throw new Error(`Inconsistencia interna: versión activa ${publishedVersionId} no tiene snapshot`);
    }

    return snapshot;
  }

  // tenantId y flowId son parte de la clave — nunca cross-tenant.
  public getSnapshotByVersion(tenantId: string, flowId: string, versionId: string): FlowSnapshot {
    const key = `${tenantId}:${flowId}:${versionId}`;
    const snapshot = this.snapshotsByVersion.get(key);

    if (!snapshot) {
      throw new Error(
        `No existe snapshot para tenant=${tenantId} flow=${flowId} version=${versionId}`
      );
    }

    return snapshot;
  }

  // Publica un snapshot y lo activa como versión runtime activa.
  // La clave de almacenamiento incluye tenantId+flowId para tenant isolation.
  // La clave pública (getPublishedSnapshot) usa tenantId+flowKey para el routing.
  public publish(snapshot: FlowSnapshot): void {
    const storageKey = `${snapshot.flow.tenantId}:${snapshot.flow.id}:${snapshot.version.id}`;
    this.snapshotsByVersion.set(storageKey, snapshot);

    // El routing de "versión activa" usa flowKey para el lookup en handle()
    const routingKey = `${snapshot.flow.tenantId}:${snapshot.flow.key}`;
    this.publishedByTenantAndKey.set(routingKey, storageKey);

    // Actualizar concepto explícito de versión activa
    const activeVersion: ActiveFlowVersion = {
      tenantId: snapshot.flow.tenantId,
      flowId: snapshot.flow.id,
      flowKey: snapshot.flow.key,
      activeVersionId: snapshot.version.id,
      activatedAt: new Date().toISOString()
    };
    this.activeVersionsByFlow.set(routingKey, activeVersion);
  }

  public getActiveVersion(tenantId: string, flowKey: string): ActiveFlowVersion | undefined {
    return this.activeVersionsByFlow.get(`${tenantId}:${flowKey}`);
  }
}
