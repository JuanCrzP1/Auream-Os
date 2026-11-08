import type { AutomationRepository } from "./AutomationRepository";
import type { AutomationFlow } from "../domain/AutomationFlow";
import { NotFoundError } from "../../../../platform/observability/errors/NotFoundError";

/**
 * Archivar o restaurar una automatización. Archivar la saca de la vista
 * normal sin borrar nada; restaurarla la devuelve como borrador.
 *
 * No escribe si ya está en el estado pedido (no mueve `updatedAt`).
 */
export class SetAutomationArchivedService {
  public constructor(private readonly automationRepository: AutomationRepository) {}

  public async execute(tenantId: string, flowId: string, archived: boolean): Promise<AutomationFlow> {
    const flow = await this.automationRepository.findById(tenantId, flowId);
    if (!flow) throw new NotFoundError("La automatización no existe.");

    if ((flow.status === "archived") === archived) return flow;

    const updated: AutomationFlow = {
      ...flow,
      status: archived ? "archived" : "draft",
      metadata: { ...flow.metadata, updatedAt: new Date().toISOString() }
    };
    await this.automationRepository.save(updated);
    return updated;
  }
}
