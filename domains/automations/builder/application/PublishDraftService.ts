import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { BuilderWorkspaceRepository } from "./BuilderWorkspaceRepository";
import type { GraphValidator } from "../../validation/application/GraphValidator";
import { convertBuilderSnapshotToRuntime } from "./convertBuilderSnapshotToRuntime";
import { createVersionedBuilderSnapshot } from "./createVersionedBuilderSnapshot";

export class PublishDraftService {
  public constructor(
    private readonly repository: BuilderWorkspaceRepository,
    private readonly validator: GraphValidator
  ) {}

  public async execute(workspace: PersistedBuilderWorkspace): Promise<PersistedBuilderWorkspace> {
    // Validar el grafo antes de marcar como published.
    // La validación se hace sobre el snapshot convertido a runtime porque
    // GraphValidator trabaja con FlowSnapshot (con tenantId, flowVersionId, etc.)
    const runtimeSnapshot = convertBuilderSnapshotToRuntime(workspace.draft, workspace.tenantId);
    const report = this.validator.validate(runtimeSnapshot);

    if (report.errors.length > 0) {
      const messages = report.errors.map((issue) => issue.message).join(" | ");
      throw new Error(`No se puede publicar el flow: ${messages}`);
    }

    const nextPublishedVersion = workspace.publishedSnapshots.length + 1;
    const publishedSnapshot = createVersionedBuilderSnapshot(workspace.draft, "published", nextPublishedVersion);
    const nextDraft = createVersionedBuilderSnapshot(publishedSnapshot, "draft", nextPublishedVersion + 1);

    const nextWorkspace: PersistedBuilderWorkspace = {
      ...workspace,
      draft: nextDraft,
      publishedSnapshots: [...workspace.publishedSnapshots, publishedSnapshot],
      updatedAt: new Date().toISOString(),
      autosaveRevision: workspace.autosaveRevision + 1
    };

    await this.repository.saveWorkspace(nextWorkspace);
    return nextWorkspace;
  }
}

