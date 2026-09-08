import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";

export interface BuilderWorkspaceRepository {
  getWorkspace(tenantId: string, flowKey: string): Promise<PersistedBuilderWorkspace | null>;
  /** Lectura sin efectos secundarios para proyecciones de listado. */
  getWorkspaces(tenantId: string, flowKeys: readonly string[]): Promise<PersistedBuilderWorkspace[]>;
  saveWorkspace(workspace: PersistedBuilderWorkspace): Promise<void>;
  deleteWorkspace(tenantId: string, flowKey: string): Promise<void>;
}
