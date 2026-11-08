import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { AutomationFlow } from "../../catalog/domain/AutomationFlow";
import type { AutomationsUnitOfWork } from "./AutomationsUnitOfWork";
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
    private readonly unitOfWork: AutomationsUnitOfWork,
    private readonly workspaceFactory: (tenantId: string, flowKey: string) => PersistedBuilderWorkspace
  ) {}

  public async execute(tenantId: string, options: { name?: string; folderId?: string } = {}): Promise<AutomationFlow> {
    return this.unitOfWork.run(async ({ automations, folders, workspaces }) => {
      if (options.folderId !== undefined && !(await folders.findById(tenantId, options.folderId))) {
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

      // En una transacción (C3): catálogo y borrador, o ninguno. El catálogo
      // va primero porque el borrador cuelga de él (FK en SQL).
      await automations.save(flow);
      await workspaces.saveWorkspace(workspace);
      return flow;
    });
  }
}
