import { groupName, type Campaign } from "../domain/Campaign";
import { connectionFor, needsNextGroup, nextPosition, type RotatingGroup } from "../domain/Rotation";
import type { GroupEngine } from "./GroupEngine";
import type { WaGroup } from "./GroupPorts";

// ---------------------------------------------------------------------------
// Crea el grupo siguiente de una campaña cuando hace falta: por el número que
// le toca (por turnos), con el nombre « #n», la foto, la descripción y las
// reglas de la campaña, y guarda su enlace de invitación. Si dos procesos lo
// intentan a la vez, solo uno queda guardado (posición única por campaña).
// ---------------------------------------------------------------------------

export function rotating(group: WaGroup): RotatingGroup {
  return { id: group.id, position: group.position ?? 0, members: group.members, state: group.isAdmin ? "open" : "other", inviteLink: group.inviteLink };
}

export class GroupMaker {
  public constructor(private readonly engine: GroupEngine) {}

  /** El grupo creado, o `null` si no hacía falta (o la campaña está cerrada). */
  public async prepare(tenantId: string, campaignId: string): Promise<WaGroup | null> {
    const { campaigns, groups, now } = this.engine;
    const campaign = await campaigns.find(tenantId, campaignId);
    if (!campaign || campaign.status !== "active") return null;
    const current = await groups.list(tenantId, campaign.id);
    if (!needsNextGroup(current.map(rotating), campaign.capacity)) return null;
    return this.create(campaign, nextPosition(current.map(rotating)), now());
  }

  private async create(campaign: Campaign, position: number, at: Date): Promise<WaGroup | null> {
    const { gateway, groups, newId } = this.engine;
    const tenantId = campaign.tenantId;
    const connectionId = await this.connectionFor(campaign, position);
    const name = groupName(campaign.template.namePattern, position);
    const { jid } = await gateway.create(tenantId, connectionId, name);
    const { description, imageUrl, announce, locked } = campaign.template;
    // Si una parte de la configuración falla, el grupo igual sirve: se reintenta al editar la campaña.
    await gateway.configure(tenantId, connectionId, jid, { ...(description ? { description } : {}), ...(imageUrl ? { imageUrl } : {}), announce, locked }).catch(() => undefined);
    const inviteLink = await gateway.inviteLink(tenantId, connectionId, jid);
    const group: WaGroup = {
      id: newId(), tenantId, connectionId, jid, name, description, imageUrl, members: 1, isAdmin: true, announce, locked, inviteLink,
      campaignId: campaign.id, position, syncedAt: at.toISOString(), lastWelcomeAt: at.toISOString(), createdAt: at.toISOString()
    };
    return (await groups.insertCreated(group)) ? group : null;
  }

  /** Por turnos entre los números de la campaña que siguen conectados. */
  private async connectionFor(campaign: Campaign, position: number): Promise<string> {
    const numbers = await this.engine.numbers.list(campaign.tenantId);
    const usable = campaign.connectionIds.filter((id) => numbers.some((n) => n.id === id && n.connected && n.qr));
    if (usable.length === 0) throw new Error("Ningún número de la campaña está conectado para crear el grupo.");
    return connectionFor(usable, position);
  }
}
