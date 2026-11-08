import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { AutomationRepository } from "../../catalog/application/AutomationRepository";
import type { AutomationsUnitOfWork } from "./AutomationsUnitOfWork";
import { ConflictError } from "../../../../platform/observability/errors/ConflictError";
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
  public constructor(private readonly unitOfWork: AutomationsUnitOfWork) {}

  /**
   * Guarda el borrador y, si cambió, el nombre en el catálogo: en UNA
   * transacción (FASE C3).
   *
   * BLOQUEO OPTIMISTA (FASE C4): `baseRevision` es la revisión sobre la que el
   * cliente editó. Si ya no es la actual (otra pestaña u otra persona guardó
   * antes), se rechaza con `ConflictError` en vez de pisar ese trabajo. Y aun
   * sin ella, la escritura exige que la revisión no haya cambiado desde que se
   * leyó `workspace` (atómico en SQL).
   */
  public async execute(
    workspace: PersistedBuilderWorkspace,
    draft: BuilderFlowSnapshot,
    options: { readonly baseRevision?: number } = {}
  ): Promise<PersistedBuilderWorkspace> {
    if (options.baseRevision !== undefined && options.baseRevision !== workspace.autosaveRevision) {
      throw new ConflictError("El borrador cambió desde que se abrió. Recarga para ver la última versión.");
    }

    // La identidad del flujo la fija el servidor: un borrador no puede
    // declararse de otro flujo para colarse en él.
    const normalizedDraft = createVersionedBuilderSnapshot(
      { ...draft, flow: { ...draft.flow, id: workspace.draft.flow.id, key: workspace.flowKey } },
      "draft",
      draft.version.versionNumber
    );
    const nextWorkspace: PersistedBuilderWorkspace = {
      ...workspace,
      draft: normalizedDraft,
      updatedAt: new Date().toISOString(),
      autosaveRevision: workspace.autosaveRevision + 1
    };

    await this.unitOfWork.run(async ({ workspaces, automations }) => {
      await workspaces.saveWorkspace(nextWorkspace, { expectedRevision: workspace.autosaveRevision });
      await renameFlowIfNeeded(automations, nextWorkspace);
    });

    return nextWorkspace;
  }
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
async function renameFlowIfNeeded(automations: AutomationRepository, workspace: PersistedBuilderWorkspace): Promise<void> {
  const nombre = workspace.draft.flow.name;
  const flow = await automations.findById(workspace.tenantId, workspace.flowKey);

  if (!flow || flow.name === nombre) return;

  await automations.save({
    ...flow,
    name: nombre,
    metadata: { ...flow.metadata, updatedAt: workspace.updatedAt }
  });
}
