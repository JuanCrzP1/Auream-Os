import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { BuilderWorkspaceRepository } from "./BuilderWorkspaceRepository";
import type { AutomationRepository } from "../../catalog/application/AutomationRepository";

export class GetBuilderWorkspaceService {
  public constructor(
    private readonly repository: BuilderWorkspaceRepository,
    private readonly workspaceFactory: (tenantId: string, flowKey: string) => PersistedBuilderWorkspace,
    private readonly automationRepository: AutomationRepository
  ) {}

  /**
   * El borrador de una automatización, o `null` si no existe en este tenant.
   *
   * SIN EFECTOS: abrir no escribe nada. Antes, abrir un id desconocido creaba
   * la automatización (un `GET` que escribía y que permitía crear con permiso
   * de solo lectura). Crear es ahora `CreateAutomationService`.
   *
   * Si el catálogo la tiene pero aún no hay borrador guardado, se sirve el
   * inicial EN MEMORIA; el primer autoguardado lo escribe.
   */
  public async execute(tenantId: string, flowKey: string): Promise<PersistedBuilderWorkspace | null> {
    const existing = await this.repository.getWorkspace(tenantId, flowKey);
    if (existing) return this.withCatalogName(existing);

    const flow = await this.automationRepository.findById(tenantId, flowKey);
    if (!flow) return null;

    return this.withCatalogName(this.workspaceFactory(tenantId, flowKey));
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