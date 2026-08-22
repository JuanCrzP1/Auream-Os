import type { FolderRepository } from "./FolderRepository";
import type { AutomationFolder } from "../domain/AutomationFolder";

export class CreateFolderService {
  constructor(private readonly folderRepo: FolderRepository) {}

  async execute(tenantId: string, name: string, parentFolderId?: string): Promise<AutomationFolder> {
    const folder: AutomationFolder = {
      id: crypto.randomUUID(),
      tenantId,
      name,
      parentFolderId,
      createdAt: new Date().toISOString()
    };
    await this.folderRepo.save(folder);
    return folder;
  }
}
