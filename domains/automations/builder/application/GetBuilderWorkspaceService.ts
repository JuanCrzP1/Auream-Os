import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { BuilderWorkspaceRepository } from "./BuilderWorkspaceRepository";
import type { AutomationRepository } from "../../catalog/application/AutomationRepository";

export class GetBuilderWorkspaceService {
  public constructor(
    private readonly repository: BuilderWorkspaceRepository,
    private readonly workspaceFactory: (tenantId: string, flowKey: string) => PersistedBuilderWorkspace,
    private readonly automationRepository: AutomationRepository
  ) {}

  public async execute(tenantId: string, flowKey: string): Promise<PersistedBuilderWorkspace> {
    const existing = await this.repository.getWorkspace(tenantId, flowKey);

    if (existing) {
      return existing;
    }

    const seeded = this.workspaceFactory(tenantId, flowKey);
    await this.repository.saveWorkspace(seeded);

    // Auto-registrar el flow en el catálogo de automatizaciones si no existe aún.
    // Garantiza que todo workspace del builder tenga una entrada visible en el hub.
    const existingFlow = await this.automationRepository.findById(tenantId, flowKey);
    if (!existingFlow) {
      await this.automationRepository.save({
        id: flowKey,
        tenantId,
        key: flowKey,
        name: seeded.draft.flow.name,
        status: "draft",
        metadata: {
          createdAt: seeded.updatedAt,
          updatedAt: seeded.updatedAt
        }
      });
    }

    return seeded;
  }
}