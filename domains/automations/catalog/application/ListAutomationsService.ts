import type { AutomationRepository } from "./AutomationRepository";
import type { FolderRepository } from "./FolderRepository";
import type { AutomationFlow } from "../domain/AutomationFlow";
import type { AutomationFolder } from "../domain/AutomationFolder";
import type { BuilderWorkspaceRepository } from "../../builder/application/BuilderWorkspaceRepository";
import { deriveBuilderGraphSummary, type BuilderGraphSummary } from "../../builder/application/deriveBuilderGraphSummary";

export interface AutomationListItem {
  readonly flow: AutomationFlow;
  readonly graphSummary: BuilderGraphSummary;
}

export interface ListAutomationsResult {
  flows: AutomationListItem[];
  folders: AutomationFolder[];
}

export class ListAutomationsService {
  constructor(
    private readonly automationRepo: AutomationRepository,
    private readonly folderRepo: FolderRepository,
    private readonly workspaceRepo: BuilderWorkspaceRepository
  ) {}

  async execute(tenantId: string): Promise<ListAutomationsResult> {
    const [flows, folders] = await Promise.all([
      this.automationRepo.findByTenant(tenantId),
      this.folderRepo.findByTenant(tenantId)
    ]);
    // Una sola lectura de repositorio para todo el Hub. Los workspaces que no
    // existan no se crean: su resumen es el estado vacío y desconectado.
    const workspaces = await this.workspaceRepo.getWorkspaces(tenantId, flows.map((flow) => flow.key));
    const workspaceByKey = new Map(workspaces.map((workspace) => [workspace.flowKey, workspace]));

    return {
      flows: flows.map((flow) => {
        const workspace = workspaceByKey.get(flow.key);
        return {
          flow,
          graphSummary: workspace
            ? deriveBuilderGraphSummary(workspace.draft, tenantId)
            : { nodeCount: 0, connectionStatus: "disconnected" }
        };
      }),
      folders
    };
  }
}
