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
      return this.withCatalogName(existing);
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

  /**
   * Devuelve el workspace con el nombre que manda: el del flujo en el catálogo.
   *
   * El borrador guarda una copia de ese nombre, y esa copia envejece en cuanto
   * el flujo se renombra desde el hub. Proyectarlo al leer hace que solo haya
   * una verdad —`AutomationFlow.name`— sin obligar a migrar los workspaces ya
   * escritos ni a mantener dos escrituras sincronizadas.
   *
   * Si el flujo no está en el catálogo no se inventa nada: se sirve tal cual.
   */
  private async withCatalogName(
    workspace: PersistedBuilderWorkspace
  ): Promise<PersistedBuilderWorkspace> {
    const flow = await this.automationRepository.findById(workspace.tenantId, workspace.flowKey);

    if (!flow || flow.name === workspace.draft.flow.name) return workspace;

    return {
      ...workspace,
      draft: { ...workspace.draft, flow: { ...workspace.draft.flow, name: flow.name } }
    };
  }
}