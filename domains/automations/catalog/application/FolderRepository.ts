import type { AutomationFolder } from "../domain/AutomationFolder";

export interface FolderRepository {
  findByTenant(tenantId: string): Promise<AutomationFolder[]>;
  findById(tenantId: string, id: string): Promise<AutomationFolder | undefined>;
  save(folder: AutomationFolder): Promise<void>;
}
