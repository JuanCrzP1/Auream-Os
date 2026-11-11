import { GROUP_LIMITS } from "../../../contracts/GroupContracts";
import type { GroupEngine } from "./GroupEngine";

// Un eslabón del envío a grupos: el siguiente grupo pendiente, por el número
// que lo administra, y el siguiente tras una pausa al azar de 10 a 30 s.
export class PostDispatcher {
  public constructor(private readonly engine: GroupEngine) {}

  public async tick(tenantId: string, postId: string): Promise<void> {
    const { posts, groups, gateway, ticker, now, random } = this.engine;
    const post = await posts.find(tenantId, postId);
    if (!post || (post.status !== "scheduled" && post.status !== "sending")) return;
    if (post.status === "scheduled") await posts.transition(tenantId, postId, ["scheduled"], "sending");
    const next = await posts.claimNext(tenantId, postId);
    if (!next) {
      await posts.transition(tenantId, postId, ["sending"], "done", now());
      return;
    }
    const group = await groups.find(tenantId, next.groupId);
    let outcome: { ok: boolean; providerMessageId: string | null; error: string | null };
    try {
      if (!group) throw new Error("El grupo ya no existe.");
      const id = await gateway.send(tenantId, group.connectionId, group.jid, post.content, post.mentionAll ? "all" : null);
      outcome = { ok: true, providerMessageId: id, error: null };
    } catch (error) {
      outcome = { ok: false, providerMessageId: null, error: error instanceof Error ? error.message.slice(0, 300) : "No se pudo enviar." };
    }
    await posts.finishDelivery(tenantId, next.deliveryId, outcome, now());
    const [min, max] = GROUP_LIMITS.postPauseSeconds;
    await ticker.post(tenantId, postId, new Date(now().getTime() + Math.round((min + random() * (max - min)) * 1000)));
  }
}
