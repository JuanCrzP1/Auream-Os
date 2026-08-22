import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";

export interface BuilderWorkspaceRepository {
  getWorkspace(tenantId: string, flowKey: string): Promise<PersistedBuilderWorkspace | null>;
  saveWorkspace(workspace: PersistedBuilderWorkspace): Promise<void>;
  deleteWorkspace(tenantId: string, flowKey: string): Promise<void>;
}