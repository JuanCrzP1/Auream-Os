import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { BuilderWorkspaceRepository } from "./BuilderWorkspaceRepository";
import { createVersionedBuilderSnapshot } from "./createVersionedBuilderSnapshot";

export class RollbackDraftService {
  public constructor(private readonly repository: BuilderWorkspaceRepository) {}

  public async execute(workspace: PersistedBuilderWorkspace): Promise<PersistedBuilderWorkspace> {
    if (workspace.publishedSnapshots.length === 0) {
      throw new Error("No existe una version publicada para hacer rollback.");
    }

    const targetSnapshot = workspace.publishedSnapshots.length > 1
      ? workspace.publishedSnapshots[workspace.publishedSnapshots.length - 2]
      : workspace.publishedSnapshots[workspace.publishedSnapshots.length - 1];

    const rollbackVersion = workspace.publishedSnapshots.length + 1;
    const rollbackPublished = createVersionedBuilderSnapshot(targetSnapshot, "published", rollbackVersion);
    const nextDraft = createVersionedBuilderSnapshot(rollbackPublished, "draft", rollbackVersion + 1);

    const nextWorkspace: PersistedBuilderWorkspace = {
      ...workspace,
      draft: nextDraft,
      publishedSnapshots: [...workspace.publishedSnapshots, rollbackPublished],
      updatedAt: new Date().toISOString(),
      autosaveRevision: workspace.autosaveRevision + 1
    };

    await this.repository.saveWorkspace(nextWorkspace);
    return nextWorkspace;
  }
}