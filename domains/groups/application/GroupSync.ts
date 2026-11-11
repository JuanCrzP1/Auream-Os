import type { GroupEngine } from "./GroupEngine";
import type { GroupMaker } from "./GroupMaker";

// ---------------------------------------------------------------------------
// Trae de WhatsApp los grupos de cada número por QR conectado (con sus
// miembros) y los pone al día en Auream. La corren: el botón «Actualizar», la
// creación de una campaña y una revisión cada 30 minutos mientras haya
// campañas activas (los avisos de entradas y salidas pueden perderse).
// ---------------------------------------------------------------------------

export const SYNC_EVERY_MS = 30 * 60_000;

export class GroupSync {
  public constructor(
    private readonly engine: GroupEngine,
    private readonly maker: Pick<GroupMaker, "prepare">
  ) {}

  /** Devuelve cuántos números se pudieron revisar. */
  public async syncTenant(tenantId: string): Promise<{ readonly numbers: number; readonly failed: ReadonlyArray<string> }> {
    const { numbers, gateway, groups, campaigns, ticker, now } = this.engine;
    const usable = (await numbers.list(tenantId)).filter((number) => number.connected && number.qr);
    const failed: string[] = [];
    for (const number of usable) {
      try {
        await groups.saveSynced(tenantId, number.id, await gateway.list(tenantId, number.id), now());
      } catch {
        failed.push(number.name);
      }
    }
    const active = (await campaigns.list(tenantId)).filter((campaign) => campaign.status === "active");
    for (const campaign of active) await this.maker.prepare(tenantId, campaign.id).catch(() => null);
    if (active.length > 0) await ticker.sync(tenantId, new Date(now().getTime() + SYNC_EVERY_MS));
    return { numbers: usable.length - failed.length, failed };
  }
}
