import type { FlowSnapshot } from "../../../contracts/FlowSnapshot";
import type { ActiveFlowVersion, FlowRegistry } from "../../../flow-engine/registry/FlowRegistry";
import type { BuilderWorkspaceRepository } from "../builder/application/BuilderWorkspaceRepository";
import { convertBuilderSnapshotToRuntime } from "../builder/application/convertBuilderSnapshotToRuntime";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";

// ---------------------------------------------------------------------------
// SavedFlowRegistry — los flujos que corre el motor en producción.
//
// Auream no publica ni versiona: lo guardado es lo que corre (ver ROADMAP,
// B6). El motor pide «el flujo X de la cuenta» y recibe su borrador guardado,
// ya migrado al formato vigente por el repositorio. Una sesión que empezó con
// una versión anterior sigue con lo último guardado: no hay historial.
// ---------------------------------------------------------------------------

export class SavedFlowRegistry implements FlowRegistry {
  public constructor(private readonly workspaces: BuilderWorkspaceRepository) {}

  public async getPublishedSnapshot(tenantId: string, flowKey: string): Promise<FlowSnapshot> {
    const workspace = await this.workspaces.getWorkspace(tenantId, flowKey);
    if (!workspace) throw new NotFoundError(`El flujo «${flowKey}» no existe en la cuenta.`);
    return convertBuilderSnapshotToRuntime(workspace.draft, tenantId);
  }

  /** Sin versiones: la de una sesión en curso es la última guardada. */
  public async getSnapshotByVersion(tenantId: string, flowId: string): Promise<FlowSnapshot> {
    return this.getPublishedSnapshot(tenantId, flowId);
  }

  public async publish(): Promise<void> {
    throw new Error("Los flujos no se publican: se guardan y lo guardado es lo que corre.");
  }

  public async getActiveVersion(tenantId: string, flowKey: string): Promise<ActiveFlowVersion | undefined> {
    const workspace = await this.workspaces.getWorkspace(tenantId, flowKey);
    if (!workspace) return undefined;
    return { tenantId, flowId: workspace.draft.flow.id, flowKey, activeVersionId: workspace.draft.version.id, activatedAt: workspace.updatedAt };
  }
}
