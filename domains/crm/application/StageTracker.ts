import { countryOfPhone } from "../../../contracts/Countries";
import type { Money } from "../../../contracts/CrmContracts";
import type { Pipeline, Stage } from "../domain/Pipeline";
import type { ContactLabeler, CrmProductCatalog, CrmTeamDirectory, LabelOrigin, TurnCounter } from "./CrmGateways";
import type { CrmEventLog, DealRepository, PipelineRepository } from "./CrmRepositories";

// ---------------------------------------------------------------------------
// StageTracker — escucha a Contactos y a Ventas y lleva el CRM al día.
//
//   labelsChanged   le pusieron o quitaron la etiqueta de una etapa (un flujo,
//                   el chat, la ficha o el tablero): anota en qué etapa está,
//                   desde cuándo, el historial y, si es nuevo en el embudo, su
//                   valor por defecto y su responsable por turnos.
//   contactCreated  un contacto nuevo entra a la etapa de entrada de cada embudo.
//   saleApproved    quien compra pasa a la etapa de compra, con el valor real.
//
// Nunca lanza: un fallo del CRM no puede romper un flujo ni el chat (se avisa
// por `onError`).
// ---------------------------------------------------------------------------

export interface ApprovedSale {
  readonly contactId: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly productId: string | null;
  readonly productName: string | null;
}

export class StageTracker {
  public constructor(
    private readonly pipelines: PipelineRepository,
    private readonly deals: DealRepository,
    private readonly events: CrmEventLog,
    private readonly labeler: ContactLabeler,
    private readonly catalog: CrmProductCatalog,
    private readonly team: CrmTeamDirectory,
    private readonly turns: TurnCounter,
    private readonly onError: (error: unknown, context: Record<string, unknown>) => void
  ) {}

  public async labelsChanged(tenantId: string, contactId: string, change: { added: ReadonlyArray<string>; removed: ReadonlyArray<string> }, origin: LabelOrigin): Promise<void> {
    try {
      const stages = await this.pipelines.stagesForLabels(tenantId, [...change.added, ...change.removed]);
      const byPipeline = new Map<string, Stage[]>();
      for (const stage of stages) byPipeline.set(stage.pipelineId, [...(byPipeline.get(stage.pipelineId) ?? []), stage]);
      for (const [pipelineId, touched] of byPipeline) {
        const to = touched.filter((stage) => change.added.includes(stage.labelId)).sort((a, b) => b.position - a.position)[0] ?? null;
        const from = touched.find((stage) => change.removed.includes(stage.labelId)) ?? null;
        if (to) await this.enter(tenantId, pipelineId, contactId, to, from, origin);
        else if (from) await this.leave(tenantId, pipelineId, contactId, from, origin);
      }
    } catch (error) {
      this.onError(error, { step: "crm.labels_changed", tenantId, contactId });
    }
  }

  public async contactCreated(tenantId: string, contactId: string): Promise<void> {
    try {
      const pipelines = await this.pipelines.list(tenantId);
      const labels = pipelines.map((pipeline) => pipeline.stages.find((stage) => stage.id === pipeline.entryStageId)?.labelId).filter((id): id is string => Boolean(id));
      if (labels.length > 0) await this.labeler.change(tenantId, contactId, { add: labels, remove: [] }, { kind: "auto" });
    } catch (error) {
      this.onError(error, { step: "crm.contact_created", tenantId, contactId });
    }
  }

  public async saleApproved(tenantId: string, sale: ApprovedSale): Promise<void> {
    if (!sale.contactId) return;
    try {
      const contact = await this.labeler.snapshot(tenantId, sale.contactId);
      if (!contact) return;
      const value = sale.amount !== null && sale.currency ? { amount: sale.amount, currency: sale.currency } : null;
      for (const pipeline of await this.pipelines.list(tenantId)) {
        const target = pipeline.stages.find((stage) => stage.id === pipeline.saleStageId);
        if (!target) continue;
        // Quien ya va más adelante (p. ej. «Entregado») no se devuelve a «Pagó».
        const ahead = pipeline.stages.some((stage) => stage.outcome === "won" && stage.position >= target.position && contact.labelIds.includes(stage.labelId));
        if (!ahead) await this.labeler.change(tenantId, sale.contactId, { add: [target.labelId], remove: [] }, { kind: "sale" });
        if (value && (await this.deals.find(tenantId, pipeline.id, sale.contactId))) {
          await this.deals.update(tenantId, pipeline.id, sale.contactId, { value, productId: sale.productId, productName: sale.productName });
        }
      }
    } catch (error) {
      this.onError(error, { step: "crm.sale_approved", tenantId, contactId: sale.contactId });
    }
  }

  private async enter(tenantId: string, pipelineId: string, contactId: string, to: Stage, from: Stage | null, origin: LabelOrigin): Promise<void> {
    const pipeline = await this.pipelines.find(tenantId, pipelineId);
    if (!pipeline) return;
    const before = await this.deals.find(tenantId, pipelineId, contactId);
    const fresh = !before || before.stageId === null;
    const value = fresh && !before?.value ? await this.defaultValue(tenantId, pipeline, contactId) : null;
    const ownerId = fresh && !before?.ownerId && pipeline.autoAssign ? await this.nextOwner(tenantId, pipelineId) : null;
    await this.deals.enter(tenantId, pipelineId, contactId, {
      stageId: to.id,
      won: to.outcome === "won",
      value: value?.money ?? null,
      productId: value?.productId ?? null,
      productName: value?.productName ?? null,
      ownerId: ownerId?.userId ?? null
    });
    const fromStageId = from?.id ?? before?.stageId ?? null;
    if (fromStageId !== to.id) await this.log(tenantId, pipelineId, contactId, "stage", fromStageId, to.id, origin, origin.note ?? null);
    if (ownerId) await this.log(tenantId, pipelineId, contactId, "owner", null, null, { kind: "auto" }, ownerId.name);
  }

  private async leave(tenantId: string, pipelineId: string, contactId: string, from: Stage, origin: LabelOrigin): Promise<void> {
    await this.deals.leave(tenantId, pipelineId, contactId);
    await this.log(tenantId, pipelineId, contactId, "left", from.id, null, origin, null);
  }

  private log(tenantId: string, pipelineId: string, contactId: string, kind: "stage" | "left" | "owner", fromStageId: string | null, toStageId: string | null, origin: LabelOrigin, detail: string | null) {
    return this.events.append(tenantId, {
      pipelineId,
      contactId,
      kind,
      fromStageId,
      toStageId,
      source: origin.kind,
      actorId: origin.userId ?? null,
      flowKey: origin.flowKey ?? null,
      detail: detail?.slice(0, 300) ?? null
    });
  }

  /** El precio del producto del embudo en el país del cliente (por su número). */
  private async defaultValue(tenantId: string, pipeline: Pipeline, contactId: string): Promise<{ money: Money; productId: string; productName: string } | null> {
    if (!pipeline.defaultProductId) return null;
    const [product, contact] = await Promise.all([this.catalog.findActive(tenantId, pipeline.defaultProductId), this.labeler.snapshot(tenantId, contactId)]);
    const country = countryOfPhone(contact?.phone ?? null);
    const price = product?.prices.find((entry) => entry.country === country);
    return product && price ? { money: { amount: price.amount, currency: price.currency }, productId: product.id, productName: product.name } : null;
  }

  /** El siguiente del equipo que atiende clientes, por turnos (por embudo). */
  private async nextOwner(tenantId: string, pipelineId: string): Promise<{ userId: string; name: string } | null> {
    const sellers = (await this.team.members(tenantId)).filter((member) => member.canSell);
    if (sellers.length === 0) return null;
    const turn = await this.turns.next(tenantId, `crm:assign:${pipelineId}`);
    const picked = sellers[turn % sellers.length]!;
    return { userId: picked.userId, name: picked.name };
  }
}
