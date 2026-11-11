import { BROADCAST_LIMITS } from "../../../contracts/BroadcastContracts";
import { countryOfPhone } from "../../../contracts/Countries";
import type { Broadcast } from "../domain/Broadcast";
import { assignVariants, pickWinner, shuffle } from "../domain/Variants";
import type { BroadcastEngine } from "./BroadcastEngine";
import type { Candidate } from "./BroadcastPorts";

// ---------------------------------------------------------------------------
// Los momentos en que una difusión cambia de etapa (los dispara la cola):
//   start     a su hora: arma la lista (barajada, con su versión) y arranca
//             una cadena de envíos por cada número
//   decide    al terminar la prueba A/B: la versión que más vendió va al resto
//   followUp  horas después de terminar: el segundo envío a quien no respondió
// Todo idempotente: la cola puede repetir una tarea.
// ---------------------------------------------------------------------------

/** Las cadenas de cada número no arrancan en el mismo segundo. */
const START_SPREAD_MS = 5_000;

export class BroadcastLauncher {
  public constructor(private readonly engine: BroadcastEngine) {}

  public async start(tenantId: string, broadcastId: string): Promise<void> {
    const { broadcasts, recipients, now } = this.engine;
    const broadcast = await broadcasts.find(tenantId, broadcastId);
    if (!broadcast || broadcast.status !== "scheduled") return;

    const list = await this.recipientsOf(broadcast);
    const variants = assignVariants(list.length, broadcast.variants.length, broadcast.abTest, this.engine.random);
    // La lista no se duplica si la tarea se repite (un cliente por difusión).
    await recipients.insert(tenantId, broadcast.id, list.map((candidate, index) => ({ ...candidate, variant: variants[index]! })));

    const at = now();
    if (!(await broadcasts.transition(tenantId, broadcast.id, ["scheduled"], "sending", { startedAt: at.toISOString() }))) return;
    if (list.length === 0) {
      await broadcasts.transition(tenantId, broadcast.id, ["sending"], "done", { finishedAt: at.toISOString(), statusReason: "Nadie cumplía los filtros en ese momento." });
      return;
    }
    await this.tickEach(broadcast, new Set(list.map((candidate) => candidate.connectionId)));
  }

  public async decide(tenantId: string, broadcastId: string): Promise<void> {
    const { broadcasts, recipients, results } = this.engine;
    const broadcast = await broadcasts.find(tenantId, broadcastId);
    if (!broadcast || broadcast.status !== "testing") return;
    const scores = await results.variants(tenantId, broadcast.id);
    // La plata se compara en la moneda que más vendió la difusión.
    const currency = scores.flatMap((score) => score.revenue).sort((a, b) => b.amount - a.amount)[0]?.currency;
    const winner = pickWinner(scores.map((score) => ({ ...score, revenue: score.revenue.find((money) => money.currency === currency)?.amount ?? 0 })));
    await recipients.assignHeld(tenantId, broadcast.id, winner);
    if (!(await broadcasts.transition(tenantId, broadcast.id, ["testing"], "sending", { winner, decidesAt: null }))) return;
    const work = await recipients.work(tenantId, broadcast.id);
    await this.tickEach(broadcast, new Set(work.pendingByConnection));
  }

  public async followUp(tenantId: string, parentId: string): Promise<void> {
    const { broadcasts, now } = this.engine;
    const parent = await broadcasts.find(tenantId, parentId);
    if (!parent?.followUp || parent.followUpChildId || parent.status !== "done") return;
    const child: Broadcast = {
      id: this.engine.newId(),
      tenantId,
      name: `${parent.name} · segundo envío`.slice(0, BROADCAST_LIMITS.maxNameLength),
      variants: [parent.followUp.content],
      audience: parent.audience,
      connectionIds: parent.connectionIds,
      scheduledAt: null,
      settings: parent.settings,
      abTest: null,
      followUp: null,
      status: "scheduled",
      statusReason: null,
      parentId: parent.id,
      winner: null,
      decidesAt: null,
      followUpDueAt: null,
      followUpChildId: null,
      startedAt: null,
      finishedAt: null,
      createdBy: parent.createdBy,
      createdAt: now().toISOString()
    };
    // Un solo segundo envío por difusión (la base lo garantiza por `parent_id`).
    await broadcasts.create(child);
    const saved = await broadcasts.childOf(tenantId, parent.id);
    if (!saved) return;
    await broadcasts.update(tenantId, parent.id, { followUpChildId: saved });
    await this.start(tenantId, saved);
  }

  private async recipientsOf(broadcast: Broadcast): Promise<ReadonlyArray<Candidate>> {
    const { audience, random } = this.engine;
    if (broadcast.parentId) return audience.nonResponders(broadcast.tenantId, broadcast.parentId, BROADCAST_LIMITS.maxRecipients);
    const { candidates } = await audience.resolve(broadcast.tenantId, broadcast.audience, broadcast.connectionIds, BROADCAST_LIMITS.maxRecipients * 4);
    const countries = broadcast.audience.countries;
    const inCountry = countries.length ? candidates.filter((candidate) => countries.includes(countryOfPhone(candidate.phone) ?? "")) : candidates;
    return shuffle(inCountry, random).slice(0, BROADCAST_LIMITS.maxRecipients);
  }

  private async tickEach(broadcast: Broadcast, connectionIds: ReadonlySet<string>): Promise<void> {
    const at = this.engine.now().getTime();
    for (const connectionId of connectionIds) {
      await this.engine.ticker.tick(broadcast.tenantId, broadcast.id, connectionId, new Date(at + Math.round(this.engine.random() * START_SPREAD_MS)));
    }
  }
}
