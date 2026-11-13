import { LABEL_MERGE_BATCH } from "../../../contracts/LabelManagementContracts";
import type { LabelCatalog, LabelHolders, LabelMergeQueue, LabelMergeStore } from "./LabelManagementPorts";

// ---------------------------------------------------------------------------
// Una vuelta de «unir etiquetas» en la cola de tareas: pasa una tanda de
// clientes de la de origen a la de destino, cada uno por el camino de siempre
// (si la de destino es una etapa del CRM, entran a esa etapa y el embudo
// queda al día). Si quedan más, pide otra vuelta; si no, borra la de origen
// y la da por terminada. Repetir una vuelta no daña nada: solo pasa a quien
// todavía tiene la de origen.
// ---------------------------------------------------------------------------

export class LabelMergeRunner {
  public constructor(
    private readonly merges: LabelMergeStore,
    private readonly holders: LabelHolders,
    private readonly catalog: Pick<LabelCatalog, "delete">,
    private readonly queue: LabelMergeQueue,
    private readonly batch: number = LABEL_MERGE_BATCH
  ) {}

  public async run(tenantId: string, mergeId: string, round: number): Promise<void> {
    const merge = await this.merges.find(tenantId, mergeId);
    if (!merge || merge.status !== "running") return;
    const ids = await this.holders.holders(tenantId, merge.fromId, this.batch);
    const note = `Se unió «${merge.fromName}» en «${merge.intoName}»`;
    for (const contactId of ids) await this.holders.move(tenantId, contactId, merge.fromId, merge.intoId, note);
    if (ids.length > 0) await this.merges.advance(tenantId, mergeId, ids.length);
    if (ids.length >= this.batch) {
      await this.queue.next(tenantId, mergeId, round + 1);
      return;
    }
    await this.catalog.delete(tenantId, merge.fromId);
    await this.merges.finish(tenantId, mergeId, "done");
  }

  /** La última vuelta falló del todo: queda anotado (los clientes ya pasados se quedan en la de destino). */
  public async fail(tenantId: string, mergeId: string, error: string): Promise<void> {
    await this.merges.finish(tenantId, mergeId, "failed", error.slice(0, 300));
  }
}
