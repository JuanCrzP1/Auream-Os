import type { ActiveFlowVersion } from "./ActiveFlowVersion";
import type { FlowSnapshot } from "../../contracts/FlowSnapshot";

export type { ActiveFlowVersion };

/** Asíncrono (FASE C5): en producción los flujos se leen de la base de datos. */
export interface FlowRegistry {
  // Retorna el snapshot activo para nuevas sesiones de un tenant+flow.
  getPublishedSnapshot(tenantId: string, flowKey: string): Promise<FlowSnapshot>;

  // Retorna un snapshot específico por versión. Usado para version pinning:
  // sesiones activas mantienen su versión aunque el runtime haya avanzado.
  // tenantId y flowId son obligatorios: nunca se puede acceder cross-tenant.
  getSnapshotByVersion(tenantId: string, flowId: string, versionId: string): Promise<FlowSnapshot>;

  // Publica un snapshot e inmediatamente lo activa como versión runtime.
  // El pipeline: validate → compile → publish → activate es responsabilidad del caller.
  publish(snapshot: FlowSnapshot): Promise<void>;

  // Retorna la versión activa actual o undefined si no se ha publicado ninguna.
  getActiveVersion(tenantId: string, flowKey: string): Promise<ActiveFlowVersion | undefined>;
}
