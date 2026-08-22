import type { AutomationFlow } from "../domain/AutomationFlow";

export interface AutomationRepository {
  findByTenant(tenantId: string): Promise<AutomationFlow[]>;
  findById(tenantId: string, id: string): Promise<AutomationFlow | undefined>;
  save(flow: AutomationFlow): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}
