import type { CrmTeamDirectory } from "./CrmGateways";
import type { CrmEventLog, DealRepository } from "./CrmRepositories";

// ---------------------------------------------------------------------------
// El responsable de un cliente es uno solo: el del chat y el del embudo. Al
// tomar o pasar su chat (Conversaciones), los negocios del cliente que aún
// no tenían responsable quedan con esa persona, y queda en su historial. Los
// que ya tenían responsable no cambian: no se le quita un cliente a nadie.
// ---------------------------------------------------------------------------

export class DealOwnerClaims {
  public constructor(
    private readonly deals: DealRepository,
    private readonly events: CrmEventLog,
    private readonly team: CrmTeamDirectory
  ) {}

  public async claimUnowned(tenantId: string, contactId: string, ownerId: string, actorId: string): Promise<void> {
    // Solo la compra actual de cada embudo: las anteriores quedan como estaban.
    const unowned = (await this.deals.forContact(tenantId, contactId)).filter((deal) => deal.current && deal.ownerId === null);
    if (unowned.length === 0) return;
    const owner = (await this.team.members(tenantId)).find((member) => member.userId === ownerId && member.canSell);
    if (!owner) return;
    for (const deal of unowned) {
      await this.deals.update(tenantId, deal.pipelineId, contactId, { ownerId });
      await this.events.append(tenantId, {
        pipelineId: deal.pipelineId,
        contactId,
        kind: "owner",
        fromStageId: null,
        toStageId: null,
        source: "user",
        actorId,
        flowKey: null,
        detail: owner.name
      });
    }
  }
}
