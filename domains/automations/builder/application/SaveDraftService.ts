import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { BuilderWorkspaceRepository } from "./BuilderWorkspaceRepository";
import type { AutomationRepository } from "../../catalog/application/AutomationRepository";
import { createVersionedBuilderSnapshot } from "./createVersionedBuilderSnapshot";

/**
 * Guarda el borrador del builder.
 *
 * EL NOMBRE DEL FLUJO NO ES DEL BORRADOR, ES DEL FLUJO.
 *
 * El hub lee `AutomationFlow.name` y el editor edita `draft.flow.name`. Eran
 * dos hechos persistidos por separado y nada los reconciliaba después de crear
 * el flujo: renombrar en el editor guardaba el workspace y dejaba la tarjeta
 * del hub con el nombre viejo para siempre —comprobado en disco: el mismo id
 * con «Bienvenida a clientes» en uno y «Nueva automatización» en el otro—.
 *
 * Se resuelve declarando cuál manda: el FLUJO del catálogo. Aquí se le lleva el
 * nombre que traiga el borrador, y `GetBuilderWorkspaceService` hace el camino
 * de vuelta proyectándolo sobre el borrador que sirve. El editor sigue
 * editándolo donde lo editaba; lo que cambia es dónde queda la verdad.
 *
 * No es sincronización entre dos verdades: es una escritura en la única que
 * hay, hecha donde ya se sabe que el borrador cambió.
 */
export class SaveDraftService {
  public constructor(
    private readonly repository: BuilderWorkspaceRepository,
    private readonly automationRepository: AutomationRepository
  ) {}

  public async execute(workspace: PersistedBuilderWorkspace, draft: BuilderFlowSnapshot): Promise<PersistedBuilderWorkspace> {
    const normalizedDraft = createVersionedBuilderSnapshot(draft, "draft", draft.version.versionNumber);
    const nextWorkspace: PersistedBuilderWorkspace = {
      ...workspace,
      draft: normalizedDraft,
      updatedAt: new Date().toISOString(),
      autosaveRevision: workspace.autosaveRevision + 1
    };

    await this.repository.saveWorkspace(nextWorkspace);
    await this.renameFlowIfNeeded(nextWorkspace);

    return nextWorkspace;
  }

  /**
   * Lleva al catálogo el nombre que el usuario puso en el editor.
   *
   * Solo escribe si de verdad cambió: el autoguardado corre con cada gesto del
   * lienzo —mover un nodo, trazar una conexión— y ninguno de esos toca el
   * nombre. Sin esta comparación, cada arrastre reescribiría la entrada del hub
   * y le movería su `updatedAt` sin motivo.
   *
   * Un flujo sin entrada en el catálogo no se inventa aquí: crearla es de
   * `GetBuilderWorkspaceService`, que es quien sabe que el flujo es nuevo.
   */
  private async renameFlowIfNeeded(workspace: PersistedBuilderWorkspace): Promise<void> {
    const nombre = workspace.draft.flow.name;
    const flow = await this.automationRepository.findById(workspace.tenantId, workspace.flowKey);

    if (!flow || flow.name === nombre) return;

    await this.automationRepository.save({
      ...flow,
      name: nombre,
      metadata: { ...flow.metadata, updatedAt: workspace.updatedAt }
    });
  }
}
