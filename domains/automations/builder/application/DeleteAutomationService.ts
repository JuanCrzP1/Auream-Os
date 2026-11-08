import type { AutomationsUnitOfWork } from "./AutomationsUnitOfWork";

/**
 * DeleteAutomationService — elimina una automatización: su borrador y su
 * entrada en el catálogo, en UNA transacción (FASE C3). Idempotente: si no
 * existe, no lanza.
 */
export class DeleteAutomationService {
  public constructor(private readonly unitOfWork: AutomationsUnitOfWork) {}

  public async execute(tenantId: string, flowId: string): Promise<void> {
    await this.unitOfWork.run(async ({ automations, workspaces }) => {
      const flow = await automations.findById(tenantId, flowId);
      const flowKey = flow?.key ?? flowId;

      // En serie: dentro de una transacción hay una sola conexión.
      await workspaces.deleteWorkspace(tenantId, flowKey);
      await automations.delete(tenantId, flowId);
    });
  }
}
