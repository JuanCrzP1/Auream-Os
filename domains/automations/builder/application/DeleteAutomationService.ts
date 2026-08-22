import type { AutomationRepository } from "../../catalog/application/AutomationRepository";
import type { BuilderWorkspaceRepository } from "./BuilderWorkspaceRepository";

/**
 * DeleteAutomationService — elimina un flow del catálogo y su workspace del builder.
 *
 * Responsabilidad única: coordinación atómica del borrado en ambos repositorios.
 * Idempotente: si el flow o el workspace no existen, no lanza error.
 */
export class DeleteAutomationService {
  public constructor(
    private readonly automationRepository: AutomationRepository,
    private readonly workspaceRepository: BuilderWorkspaceRepository
  ) {}

  public async execute(tenantId: string, flowId: string): Promise<void> {
    const flow = await this.automationRepository.findById(tenantId, flowId);
    const flowKey = flow?.key ?? flowId;

    await Promise.all([
      this.automationRepository.delete(tenantId, flowId),
      this.workspaceRepository.deleteWorkspace(tenantId, flowKey)
    ]);
  }
}
