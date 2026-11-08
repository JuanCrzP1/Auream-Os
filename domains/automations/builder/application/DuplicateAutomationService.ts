import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { AutomationFlow } from "../../catalog/domain/AutomationFlow";
import type { AutomationsUnitOfWork } from "./AutomationsUnitOfWork";
import { cloneBuilderSnapshot } from "./cloneBuilderSnapshot";
import { NotFoundError } from "../../../../platform/observability/errors/NotFoundError";

/** «Bienvenida» → «Bienvenida (copia)». */
export function copyName(name: string): string {
  return `${name} (copia)`;
}

/**
 * Duplicar una automatización: copia completa del borrador (bloques,
 * configuración, conexiones y posiciones) con id y nombre nuevos, en la misma
 * carpeta. La copia nace como borrador aunque el original esté archivado, y
 * no hereda conexiones de WhatsApp: no atiende a nadie hasta que se le asigne.
 */
export class DuplicateAutomationService {
  public constructor(
    private readonly unitOfWork: AutomationsUnitOfWork,
    private readonly workspaceFactory: (tenantId: string, flowKey: string) => PersistedBuilderWorkspace
  ) {}

  public async execute(tenantId: string, flowId: string): Promise<AutomationFlow> {
    return this.unitOfWork.run(async ({ automations, workspaces }) => {
      const source = await automations.findById(tenantId, flowId);
      if (!source) throw new NotFoundError("La automatización no existe.");

      const id = crypto.randomUUID();
      const name = copyName(source.name);
      const now = new Date().toISOString();
      // Un flujo creado y nunca guardado puede no tener borrador: se copia el inicial.
      const sourceDraft =
        (await workspaces.getWorkspace(tenantId, source.key))?.draft ??
        this.workspaceFactory(tenantId, source.key).draft;
      const draft = cloneBuilderSnapshot(sourceDraft);

      const workspace: PersistedBuilderWorkspace = {
        tenantId,
        flowKey: id,
        draft: {
          ...draft,
          flow: { id, key: id, name },
          version: { ...draft.version, id: `${id}:v1:draft`, versionNumber: 1, status: "draft" }
        },
        updatedAt: now,
        autosaveRevision: 0
      };

      const copy: AutomationFlow = {
        id,
        tenantId,
        key: id,
        name,
        status: "draft",
        ...(source.folderId !== undefined ? { folderId: source.folderId } : {}),
        metadata: {
          createdAt: now,
          updatedAt: now,
          ...(source.metadata.tags !== undefined ? { tags: [...source.metadata.tags] } : {})
        }
      };

      // En una transacción (C3). Catálogo primero: el borrador cuelga de él.
      await automations.save(copy);
      await workspaces.saveWorkspace(workspace);
      return copy;
    });
  }
}
