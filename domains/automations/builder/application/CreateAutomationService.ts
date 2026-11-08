import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { AutomationRepository } from "../../catalog/application/AutomationRepository";
import type { FolderRepository } from "../../catalog/application/FolderRepository";
import type { AutomationFlow } from "../../catalog/domain/AutomationFlow";
import type { BuilderWorkspaceRepository } from "./BuilderWorkspaceRepository";
import { NotFoundError } from "../../../../platform/observability/errors/NotFoundError";

export const DEFAULT_AUTOMATION_NAME = "Nueva automatización";

/**
 * Crear una automatización: entrada en el catálogo + borrador inicial (con su
 * bloque de inicio), opcionalmente dentro de una carpeta.
 *
 * Es la ÚNICA puerta de creación. Antes se creaba al ABRIR el builder con un id
 * nuevo (un `GET`), así que un usuario con permiso de solo lectura podía crear
 * automatizaciones. Ahora abrir no escribe nada y crear exige `flows.write`.
 *
 * El id lo decide el servidor, nunca el cliente.
 */
export class CreateAutomationService {
  public constructor(
    private readonly automationRepository: AutomationRepository,
    private readonly folderRepository: FolderRepository,
    private readonly workspaceRepository: BuilderWorkspaceRepository,
    private readonly workspaceFactory: (tenantId: string, flowKey: string) => PersistedBuilderWorkspace
  ) {}

  public async execute(tenantId: string, options: { name?: string; folderId?: string } = {}): Promise<AutomationFlow> {
    if (options.folderId !== undefined && !(await this.folderRepository.findById(tenantId, options.folderId))) {
      throw new NotFoundError("La carpeta no existe.");
    }

    const id = crypto.randomUUID();
    const name = options.name?.trim() || DEFAULT_AUTOMATION_NAME;
    const seeded = this.workspaceFactory(tenantId, id);
    const workspace: PersistedBuilderWorkspace = {
      ...seeded,
      draft: { ...seeded.draft, flow: { ...seeded.draft.flow, name } }
    };

    const flow: AutomationFlow = {
      id,
      tenantId,
      key: id,
      name,
      status: "draft",
      ...(options.folderId !== undefined ? { folderId: options.folderId } : {}),
      metadata: { createdAt: workspace.updatedAt, updatedAt: workspace.updatedAt }
    };

    // Primero el catálogo: el borrador cuelga de él (FK en SQL). Si el segundo
    // paso fallara, la automatización se abre con el borrador inicial (lo sirve
    // GetBuilderWorkspaceService): nada queda corrupto. Atomicidad: FASE C3.
    await this.automationRepository.save(flow);
    await this.workspaceRepository.saveWorkspace(workspace);
    return flow;
  }
}
