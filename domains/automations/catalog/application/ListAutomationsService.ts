import type { AutomationRepository } from "./AutomationRepository";
import type { FolderRepository } from "./FolderRepository";
import type { AutomationFlow } from "../domain/AutomationFlow";
import type { AutomationFolder } from "../domain/AutomationFolder";

export interface ListAutomationsResult {
  flows: AutomationFlow[];
  folders: AutomationFolder[];
}

export class ListAutomationsService {
  constructor(
    private readonly automationRepo: AutomationRepository,
    private readonly folderRepo: FolderRepository
  ) {}

  async execute(tenantId: string): Promise<ListAutomationsResult> {
    const [flows, folders] = await Promise.all([
      this.automationRepo.findByTenant(tenantId),
      this.folderRepo.findByTenant(tenantId)
    ]);
    return { flows, folders };
  }
}
