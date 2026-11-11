import { welcomeText } from "../domain/GroupPost";
import type { GroupEngine } from "./GroupEngine";
import type { Member } from "./GroupPorts";

// ---------------------------------------------------------------------------
// Lo que pasa dentro de los grupos (avisos de WhatsApp):
//   · entradas y salidas: los miembros y el conteo al día
//   · quien entra a un grupo de campaña queda con la etiqueta de la campaña
//   · bienvenida agrupada: un solo mensaje cada N minutos con los que entraron
//   · si el grupo se acerca al cupo, se prepara el siguiente
// Los avisos pueden llegar repetidos o desordenados: todo es idempotente, y
// la sincronización periódica corrige lo que se pierda.
// ---------------------------------------------------------------------------

export interface GroupEvent {
  readonly jid: string;
  readonly joins: ReadonlyArray<Member>;
  readonly leaves: ReadonlyArray<Member>;
}

export class GroupActivity {
  public constructor(private readonly engine: GroupEngine) {}

  public async handle(tenantId: string, connectionId: string, event: GroupEvent): Promise<void> {
    const { groups, campaigns, labeler, ticker, now } = this.engine;
    const group = await groups.findByJid(tenantId, connectionId, event.jid);
    if (!group) return;
    const at = now();
    const joined = await groups.applyMoves(tenantId, group.id, event.joins, event.leaves, at);
    if (!group.campaignId) return;
    const campaign = await campaigns.find(tenantId, group.campaignId);
    if (!campaign) return;
    if (joined.length > 0 && campaign.rules.labelOnJoin) {
      for (const member of joined) if (member.phone) await labeler.tag(tenantId, member.phone, campaign.name).catch(() => undefined);
    }
    if (joined.length > 0 && campaign.rules.welcome.enabled) {
      const every = campaign.rules.welcome.everyMinutes * 60_000;
      // Un mismo tramo de N minutos comparte una sola bienvenida.
      await ticker.welcome(tenantId, group.id, new Date(Math.ceil((at.getTime() + 1) / every) * every));
    }
    if (joined.length > 0) await ticker.prepare(tenantId, campaign.id, at);
  }

  /** La bienvenida agrupada de un grupo: menciona a los que entraron desde la anterior. */
  public async welcome(tenantId: string, groupId: string): Promise<void> {
    const { groups, campaigns, gateway, now } = this.engine;
    const group = await groups.find(tenantId, groupId);
    if (!group?.campaignId) return;
    const campaign = await campaigns.find(tenantId, group.campaignId);
    if (!campaign?.rules.welcome.enabled || campaign.status !== "active") return;
    const at = now();
    const since = new Date(group.lastWelcomeAt ?? group.createdAt);
    const phones = await groups.joinedSince(tenantId, group.id, since);
    if (phones.length === 0) return;
    // Primero se marca: si el envío se repite, no saluda dos veces a los mismos.
    await groups.update(tenantId, group.id, { lastWelcomeAt: at.toISOString() });
    const people = phones.map((phone) => ({ phone }));
    const text = welcomeText(campaign.rules.welcome.text, people);
    await gateway.send(tenantId, group.connectionId, group.jid, { kind: "text", text, mediaUrl: null, fileName: null, choices: [] }, phones.slice(0, 10));
  }
}
