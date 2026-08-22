import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { BuilderWorkspaceRepository } from "./BuilderWorkspaceRepository";
import { createVersionedBuilderSnapshot } from "./createVersionedBuilderSnapshot";

export class SaveDraftService {
  public constructor(private readonly repository: BuilderWorkspaceRepository) {}

  public async execute(workspace: PersistedBuilderWorkspace, draft: BuilderFlowSnapshot): Promise<PersistedBuilderWorkspace> {
    const normalizedDraft = createVersionedBuilderSnapshot(draft, "draft", draft.version.versionNumber);
    const nextWorkspace: PersistedBuilderWorkspace = {
      ...workspace,
      draft: normalizedDraft,
      updatedAt: new Date().toISOString(),
      autosaveRevision: workspace.autosaveRevision + 1
    };

    await this.repository.saveWorkspace(nextWorkspace);
    return nextWorkspace;
  }
}