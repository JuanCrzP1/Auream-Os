import { currentGroup } from "../domain/Rotation";
import type { GroupEngine } from "./GroupEngine";
import type { GroupMaker } from "./GroupMaker";
import { rotating } from "./GroupMaker";

// ---------------------------------------------------------------------------
// El enlace público de una campaña (`/g/<slug>`): lleva al grupo con cupo.
// Anota el clic (y de dónde vino, `?src=`). Si el grupo actual va por el 90 %,
// pide preparar el siguiente; si no hay ninguno con cupo, lo crea en el
// momento (la persona espera unos segundos en lugar de un grupo lleno).
// ---------------------------------------------------------------------------

export type ClickOutcome =
  | { readonly kind: "redirect"; readonly url: string }
  | { readonly kind: "missing" | "closed" | "unavailable" };

export class LinkService {
  public constructor(
    private readonly engine: GroupEngine,
    private readonly maker: Pick<GroupMaker, "prepare">
  ) {}

  public async click(slug: string, source: string | null): Promise<ClickOutcome> {
    const { campaigns, groups, ticker, now } = this.engine;
    const campaign = await campaigns.findBySlug(slug.toLowerCase());
    if (!campaign) return { kind: "missing" };
    if (campaign.status !== "active") return { kind: "closed" };
    const at = now();
    const list = await groups.list(campaign.tenantId, campaign.id);
    let target = currentGroup(list.map(rotating), campaign.capacity);
    if (!target) {
      const created = await this.maker.prepare(campaign.tenantId, campaign.id).catch(() => null);
      target = created ? rotating(created) : currentGroup((await groups.list(campaign.tenantId, campaign.id)).map(rotating), campaign.capacity);
    } else {
      // El 90 % se revisa al preparar: si no hace falta, no hace nada.
      await ticker.prepare(campaign.tenantId, campaign.id, at).catch(() => undefined);
    }
    await groups.recordClick(campaign.tenantId, campaign.id, target?.id ?? null, source ? source.slice(0, 40) : null, at).catch(() => undefined);
    return target?.inviteLink ? { kind: "redirect", url: target.inviteLink } : { kind: "unavailable" };
  }
}
