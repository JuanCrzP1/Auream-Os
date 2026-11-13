import { BROADCAST_LIMITS } from "../../../contracts/BroadcastContracts";
import { AUTO_PAUSE, type Broadcast } from "../domain/Broadcast";
import { capToday, localTime, nextDelayMs, sendingWindow, tomorrowOpens } from "../domain/Pace";
import { personalize } from "../domain/Personalize";
import type { BroadcastEngine } from "./BroadcastEngine";
import type { RecipientRecord, SendOutcome } from "./BroadcastPorts";

// ---------------------------------------------------------------------------
// Un envío de la cadena de un número (lo dispara la cola, de a uno):
//
//   1. ¿la difusión sigue enviando? ¿el número sigue conectado?
//   2. ¿estamos en el horario? ¿queda cupo hoy (con el calentamiento)?
//      si no, la cadena sigue cuando abra
//   3. el siguiente cliente pendiente de ese número; si pidió no recibir más,
//      se salta
//   4. le envía su versión (el flujo, o el mensaje con su nombre)
//   5. demasiados fallos → se pausa sola; si no, el siguiente tras una pausa
//      al azar
//
// Al quedarse sin pendientes, la difusión termina (o pasa a decidir la prueba
// A/B) y programa el segundo envío.
// ---------------------------------------------------------------------------

/** Un envío que quedó «enviando» más que esto murió con su proceso. */
const STALE_MS = 5 * 60_000;
/** Al abrir el horario, cada número arranca en un segundo distinto. */
const OPEN_JITTER_MS = 90_000;

export class BroadcastDispatcher {
  public constructor(private readonly engine: BroadcastEngine) {}

  public async tick(tenantId: string, broadcastId: string, connectionId: string): Promise<void> {
    const { broadcasts, recipients, numbers, ticker, now, random } = this.engine;
    const broadcast = await broadcasts.find(tenantId, broadcastId);
    if (!broadcast || broadcast.status !== "sending") return;

    const number = (await numbers.list(tenantId)).find((item) => item.id === connectionId);
    if (!number?.connected) return this.autoPause(broadcast, AUTO_PAUSE.disconnected(number?.name ?? "El número"));

    const at = now();
    const timezone = await this.engine.timezoneOf(tenantId);
    const window = sendingWindow(at, timezone, broadcast.settings);
    if (!window.open) return ticker.tick(tenantId, broadcastId, connectionId, new Date(window.opensAt.getTime() + random() * OPEN_JITTER_MS));

    const sentToday = await recipients.sentSince(tenantId, connectionId, localTime(at, timezone).dayStart);
    const cap = capToday(broadcast.settings.dailyCap, await recipients.daysWithSends(tenantId, connectionId, timezone), sentToday > 0);
    if (sentToday >= cap) {
      const opens = tomorrowOpens(at, timezone, broadcast.settings.fromHour);
      return ticker.tick(tenantId, broadcastId, connectionId, new Date(opens.getTime() + random() * OPEN_JITTER_MS));
    }

    await recipients.expireStale(tenantId, broadcastId, new Date(at.getTime() - STALE_MS));
    const recipient = await recipients.claimNext(tenantId, broadcastId, connectionId, at);
    if (!recipient) return this.wrapUp(broadcast);

    if (await this.engine.optOuts.has(tenantId, recipient.phone)) {
      await recipients.finish(tenantId, recipient.id, { status: "opted_out", providerMessageId: null, error: null, at });
      return ticker.tick(tenantId, broadcastId, connectionId, new Date(at.getTime() + 1_000));
    }

    const outcome = await this.send(broadcast, recipient);
    await recipients.finish(tenantId, recipient.id, { status: outcome.ok ? "sent" : "failed", providerMessageId: outcome.providerMessageId, error: outcome.error, at: now() });
    if (outcome.blocked) return this.autoPause(broadcast, AUTO_PAUSE.noContent);
    if (!outcome.ok) {
      const { attempted, failed } = await recipients.attempts(tenantId, broadcastId);
      const rate = attempted > 0 ? failed / attempted : 0;
      if (attempted >= BROADCAST_LIMITS.minAttemptsForFailureCheck && rate > BROADCAST_LIMITS.maxFailureRate) return this.autoPause(broadcast, AUTO_PAUSE.failures(rate));
    }
    await ticker.tick(tenantId, broadcastId, connectionId, new Date(now().getTime() + nextDelayMs(broadcast.settings.pace, random)));
  }

  private async send(broadcast: Broadcast, recipient: RecipientRecord): Promise<SendOutcome> {
    const content = broadcast.variants[recipient.variant] ?? broadcast.variants[0]!;
    try {
      if (content.kind === "flow") return await this.engine.sender.sendFlow(broadcast.tenantId, recipient, content.automationId);
      const business = (await this.engine.business?.(broadcast.tenantId)) ?? {};
      const text = personalize(content.text, recipient, broadcast.settings.optOutFooter, business);
      return await this.engine.sender.sendMessage(broadcast.tenantId, recipient, { text, media: content.media });
    } catch (error) {
      return { ok: false, providerMessageId: null, error: error instanceof Error ? error.message.slice(0, 300) : "No se pudo enviar." };
    }
  }

  /** Sin pendientes en este número: si tampoco quedan en los otros, la difusión termina. */
  private async wrapUp(broadcast: Broadcast): Promise<void> {
    const { broadcasts, recipients, ticker, now } = this.engine;
    const work = await recipients.work(broadcast.tenantId, broadcast.id);
    if (work.pendingByConnection.length > 0 || work.inFlight > 0) return;
    const at = now();
    if (work.held > 0 && broadcast.abTest && broadcast.winner === null) {
      const decidesAt = new Date(at.getTime() + broadcast.abTest.decideAfterHours * 3_600_000);
      if (await broadcasts.transition(broadcast.tenantId, broadcast.id, ["sending"], "testing", { decidesAt: decidesAt.toISOString() })) {
        await ticker.decide(broadcast.tenantId, broadcast.id, decidesAt);
      }
      return;
    }
    if (!(await broadcasts.transition(broadcast.tenantId, broadcast.id, ["sending"], "done", { finishedAt: at.toISOString() }))) return;
    if (broadcast.followUp && !broadcast.parentId) {
      const dueAt = new Date(at.getTime() + broadcast.followUp.afterHours * 3_600_000);
      await broadcasts.update(broadcast.tenantId, broadcast.id, { followUpDueAt: dueAt.toISOString() });
      await ticker.followUp(broadcast.tenantId, broadcast.id, dueAt);
    }
  }

  private async autoPause(broadcast: Broadcast, reason: string): Promise<void> {
    if (await this.engine.broadcasts.transition(broadcast.tenantId, broadcast.id, ["sending"], "auto_paused", { statusReason: reason })) {
      await this.engine.ticker.stop(broadcast.tenantId, broadcast.id, broadcast.connectionIds);
    }
  }
}
