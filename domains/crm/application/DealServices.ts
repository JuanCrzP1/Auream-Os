import { countryOfPhone } from "../../../contracts/Countries";
import type { Money, UpdateDealRequest } from "../../../contracts/CrmContracts";
import type { ContactCrmResponse, ContactDeal } from "../../../contracts/CrmActivityContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { dealValueOf, describeMoney } from "../domain/Deal";
import type { ContactLabeler, CrmProductCatalog, CrmTeamDirectory } from "./CrmGateways";
import type { CrmEventLog, DealChanges, DealRepository, FollowUpRepository, PipelineRepository } from "./CrmRepositories";
import { UUID, toEventSummary, toFollowUpSummary, type CrmActor } from "./crmViews";
import type { PipelineServices } from "./PipelineServices";

// ---------------------------------------------------------------------------
// El cliente dentro de un embudo: su valor, su producto y su responsable
// (con su historial), y lo que muestra su ficha en todos los embudos.
// ---------------------------------------------------------------------------

const HISTORY = 50;

export class DealServices {
  public constructor(
    private readonly pipelines: PipelineServices,
    private readonly pipelineRepository: PipelineRepository,
    private readonly deals: DealRepository,
    private readonly events: CrmEventLog,
    private readonly followUps: FollowUpRepository,
    private readonly labeler: ContactLabeler,
    private readonly catalog: CrmProductCatalog,
    private readonly team: CrmTeamDirectory
  ) {}

  /** Cambiar el valor, el producto o el responsable de un cliente que está en el embudo. */
  public async update(actor: CrmActor, pipelineId: string, contactId: string, input: Partial<UpdateDealRequest>): Promise<ContactDeal> {
    const pipeline = await this.pipelines.require(actor.tenantId, pipelineId);
    const contact = UUID.test(contactId) ? await this.labeler.snapshot(actor.tenantId, contactId) : null;
    if (!contact) throw new NotFoundError("Ese cliente no existe.");
    const stage = [...pipeline.stages].sort((a, b) => b.position - a.position).find((candidate) => contact.labelIds.includes(candidate.labelId));
    if (!stage) throw new ValidationError("Ese cliente no está en este embudo.");
    // Quien tenía la etiqueta antes de que existiera el embudo aún no tiene registro: se crea al tocarlo.
    const before = (await this.deals.find(actor.tenantId, pipelineId, contactId)) ??
      (await this.deals.enter(actor.tenantId, pipelineId, contactId, { stageId: stage.id, won: stage.outcome === "won", value: null, productId: null, productName: null, ownerId: null }));

    const changes: { -readonly [K in keyof DealChanges]: DealChanges[K] } = {};
    if (input.productId !== undefined) {
      const product = input.productId ? await this.catalog.findActive(actor.tenantId, input.productId) : null;
      if (input.productId && !product) throw new ValidationError("Ese producto no existe o está archivado.");
      changes.productId = product?.id ?? null;
      changes.productName = product?.name ?? null;
      // Sin monto escrito: el precio del producto en el país del cliente.
      const price = product?.prices.find((entry) => entry.country === countryOfPhone(contact.phone));
      if (input.amount === undefined && price) changes.value = { amount: price.amount, currency: price.currency };
    }
    if (input.amount !== undefined) changes.value = dealValueOf(input.amount, input.currency);
    let ownerName: string | null = null;
    if (input.ownerId !== undefined) {
      if (input.ownerId) {
        const member = (await this.team.members(actor.tenantId)).find((candidate) => candidate.userId === input.ownerId && candidate.canSell);
        if (!member) throw new ValidationError("Esa persona no está en el equipo o es de solo lectura.");
        ownerName = member.name;
      }
      changes.ownerId = input.ownerId || null;
    }

    const saved = await this.deals.update(actor.tenantId, pipelineId, contactId, changes);
    const origin = { source: "user" as const, actorId: actor.userId, flowKey: null };
    const event = { pipelineId, contactId, fromStageId: null, toStageId: null, ...origin };
    if (changes.value !== undefined && !sameMoney(before.value, saved.value)) await this.events.append(actor.tenantId, { ...event, kind: "value", detail: describeMoney(saved.value) });
    if (changes.ownerId !== undefined && before.ownerId !== saved.ownerId) await this.events.append(actor.tenantId, { ...event, kind: "owner", detail: ownerName ?? "Sin responsable" });
    return (await this.contactDeals(actor.tenantId, contactId, contact.labelIds)).find((deal) => deal.pipelineId === pipelineId)!;
  }

  /** La ficha: en qué etapa va en cada embudo, sus seguimientos y su historial. */
  public async contact(actor: CrmActor, contactId: string): Promise<ContactCrmResponse> {
    const contact = UUID.test(contactId) ? await this.labeler.snapshot(actor.tenantId, contactId) : null;
    if (!contact) throw new NotFoundError("Ese cliente no existe.");
    const [deals, followUps, events, stored] = await Promise.all([
      this.contactDeals(actor.tenantId, contactId, contact.labelIds),
      this.followUps.list(actor.tenantId, { assigneeId: null, contactId, now: new Date(), endOfToday: new Date(), limit: 50 }),
      this.events.forContact(actor.tenantId, contactId, HISTORY),
      this.deals.forContact(actor.tenantId, contactId)
    ]);
    const purchases = stored.map((deal) => ({
      dealId: deal.id, pipelineId: deal.pipelineId, number: deal.number, current: deal.current, stageId: deal.stageId, value: deal.value,
      productName: deal.productName, openedAt: deal.openedAt, wonAt: deal.wonAt, adName: deal.adName, adSourceId: deal.adSourceId
    }));
    return { deals, purchases, followUps: followUps.map(toFollowUpSummary), events: events.map(toEventSummary) };
  }

  /** La etapa sale de sus etiquetas (como en el tablero); el valor y el responsable, de su registro. */
  private async contactDeals(tenantId: string, contactId: string, labelIds: ReadonlyArray<string>): Promise<ContactDeal[]> {
    const [pipelines, stored] = await Promise.all([this.pipelineRepository.list(tenantId), this.deals.forContact(tenantId, contactId)]);
    return pipelines.flatMap((pipeline) => {
      const stage = [...pipeline.stages].sort((a, b) => b.position - a.position).find((candidate) => labelIds.includes(candidate.labelId));
      if (!stage) return [];
      const deal = stored.find((candidate) => candidate.pipelineId === pipeline.id && candidate.current);
      return [{
        pipelineId: pipeline.id,
        stageId: stage.id,
        value: deal?.value ?? null,
        productId: deal?.productId ?? null,
        productName: deal?.productName ?? null,
        ownerId: deal?.ownerId ?? null,
        ownerName: deal?.ownerName ?? null,
        enteredAt: deal?.stageId === stage.id ? deal.stageEnteredAt : null
      }];
    });
  }
}

function sameMoney(a: Money | null, b: Money | null): boolean {
  return a === b || (a !== null && b !== null && a.amount === b.amount && a.currency === b.currency);
}
