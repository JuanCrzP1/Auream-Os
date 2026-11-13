import type { BroadcastContent } from "../../../contracts/BroadcastContracts";
import { RECIPIENT_FILTERS, type BroadcastDetailResponse, type BroadcastListResponse, type BroadcastSummary, type RecipientFilter, type RecipientsPage } from "../../../contracts/BroadcastResultsContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { canCancel, canPause, canResume, hasStarted, type Broadcast } from "../domain/Broadcast";
import { requireBroadcastDraft, requireContent } from "../domain/BroadcastDraft";
import { startOfMonth } from "../domain/Pace";
import { personalize } from "../domain/Personalize";
import type { BroadcastEngine } from "./BroadcastEngine";
import type { BroadcastLauncher } from "./BroadcastLauncher";
import type { SendOutcome } from "./BroadcastPorts";
import { mergeMoney } from "./BroadcastPorts";
import { flowIdsOf, toSummary } from "./broadcastViews";
import { numberPaces } from "./numberPaces";

// ---------------------------------------------------------------------------
// Lo que hace la pantalla de Difusiones: crear (ahora o programada), ver la
// lista y cada una con sus resultados, pausar, seguir, cancelar y enviarse
// una prueba. Las reglas del envío viven en el lanzador y el despachador.
// ---------------------------------------------------------------------------

export interface BroadcastActor {
  readonly tenantId: string;
  readonly userId: string | null;
  readonly canManage: boolean;
}

const LIST_LIMIT = 100;

export class BroadcastServices {
  public constructor(
    private readonly engine: BroadcastEngine,
    private readonly launcher: Pick<BroadcastLauncher, "start">
  ) {}

  public async create(actor: BroadcastActor, body: unknown): Promise<BroadcastSummary> {
    const now = this.engine.now();
    const draft = requireBroadcastDraft(body, now);
    await this.requireNumbers(actor.tenantId, draft.connectionIds);
    await this.requireFlows(actor.tenantId, [...draft.variants, ...(draft.followUp ? [draft.followUp.content] : [])]);
    const broadcast: Broadcast = {
      ...draft,
      id: this.engine.newId(),
      tenantId: actor.tenantId,
      status: "scheduled",
      statusReason: null,
      parentId: null,
      winner: null,
      decidesAt: null,
      followUpDueAt: null,
      followUpChildId: null,
      startedAt: null,
      finishedAt: null,
      createdBy: actor.userId,
      createdAt: now.toISOString()
    };
    await this.engine.broadcasts.create(broadcast);
    // La tarea es la red de seguridad; si es para ya, la lista se arma en este momento.
    await this.engine.ticker.start(actor.tenantId, broadcast.id, draft.scheduledAt ? new Date(draft.scheduledAt) : now);
    if (!draft.scheduledAt) await this.launcher.start(actor.tenantId, broadcast.id);
    return this.summary(actor.tenantId, broadcast.id);
  }

  public async list(actor: BroadcastActor): Promise<BroadcastListResponse> {
    const { broadcasts, results, timezoneOf, now } = this.engine;
    const list = await broadcasts.list(actor.tenantId, LIST_LIMIT);
    const [stats, names] = await Promise.all([results.stats(actor.tenantId, list.map((item) => item.id)), this.names(actor.tenantId, list)]);
    const views = list.map((item) => toSummary(item, stats.get(item.id), names));
    const monthStart = startOfMonth(now(), await timezoneOf(actor.tenantId));
    const month = views.filter((view) => view.startedAt && new Date(view.startedAt) >= monthStart);
    const sum = (pick: (view: BroadcastSummary) => number) => month.reduce((total, view) => total + pick(view), 0);
    return {
      broadcasts: views,
      month: {
        broadcasts: month.length,
        sent: sum((view) => view.stats.sent),
        read: sum((view) => view.stats.read),
        replied: sum((view) => view.stats.replied),
        bought: sum((view) => view.stats.bought),
        revenue: mergeMoney(month.flatMap((view) => view.stats.revenue)),
        autoPaused: views.filter((view) => view.status === "auto_paused").length
      },
      canManage: actor.canManage
    };
  }

  public async detail(actor: BroadcastActor, id: string): Promise<BroadcastDetailResponse> {
    const broadcast = await this.require(actor.tenantId, id);
    const timezone = await this.engine.timezoneOf(actor.tenantId);
    const [summary, variants, numbers, nextSendAt] = await Promise.all([
      this.summary(actor.tenantId, id),
      broadcast.variants.length > 1 ? this.engine.results.variants(actor.tenantId, id) : Promise.resolve([]),
      numberPaces(this.engine, actor.tenantId, broadcast.connectionIds, broadcast.settings.dailyCap, timezone),
      this.engine.ticker.next(actor.tenantId, id)
    ]);
    return { broadcast: summary, variants, numbers, nextSendAt: nextSendAt?.toISOString() ?? null, canManage: actor.canManage };
  }

  public async recipients(actor: BroadcastActor, id: string, filter: string | null, offset: number): Promise<RecipientsPage> {
    await this.require(actor.tenantId, id);
    const chosen = RECIPIENT_FILTERS.includes(filter as RecipientFilter) ? (filter as RecipientFilter) : "all";
    return this.engine.results.recipients(actor.tenantId, id, chosen, Math.max(0, Math.floor(offset) || 0), 50);
  }

  public async pause(actor: BroadcastActor, id: string): Promise<BroadcastSummary> {
    const broadcast = await this.require(actor.tenantId, id);
    if (!canPause(broadcast.status)) throw new ValidationError("Esta difusión no se puede pausar ahora.");
    await this.engine.broadcasts.transition(actor.tenantId, id, [broadcast.status], "paused", { statusReason: null });
    await this.engine.ticker.stop(actor.tenantId, id, broadcast.connectionIds);
    return this.summary(actor.tenantId, id);
  }

  public async resume(actor: BroadcastActor, id: string): Promise<BroadcastSummary> {
    const broadcast = await this.require(actor.tenantId, id);
    if (!canResume(broadcast.status)) throw new ValidationError("Esta difusión no está pausada.");
    await this.requireNumbers(actor.tenantId, broadcast.connectionIds);
    const now = this.engine.now();
    if (!hasStarted(broadcast)) {
      // Se pausó antes de su hora: vuelve a esperarla (o sale ya, si pasó).
      const at = broadcast.scheduledAt && new Date(broadcast.scheduledAt) > now ? new Date(broadcast.scheduledAt) : now;
      if (await this.engine.broadcasts.transition(actor.tenantId, id, [broadcast.status], "scheduled", { statusReason: null })) await this.engine.ticker.start(actor.tenantId, id, at);
      return this.summary(actor.tenantId, id);
    }
    if (await this.engine.broadcasts.transition(actor.tenantId, id, [broadcast.status], "sending", { statusReason: null })) {
      for (const connectionId of broadcast.connectionIds) await this.engine.ticker.tick(actor.tenantId, id, connectionId, now);
    }
    return this.summary(actor.tenantId, id);
  }

  public async cancel(actor: BroadcastActor, id: string): Promise<BroadcastSummary> {
    const broadcast = await this.require(actor.tenantId, id);
    if (!canCancel(broadcast.status)) throw new ValidationError("Esta difusión ya terminó.");
    const now = this.engine.now().toISOString();
    await this.engine.broadcasts.transition(actor.tenantId, id, [broadcast.status], "cancelled", { statusReason: "Cancelada: lo que faltaba no se envió.", finishedAt: now });
    await this.engine.ticker.stop(actor.tenantId, id, broadcast.connectionIds);
    await this.engine.recipients.cancelPending(actor.tenantId, id);
    return this.summary(actor.tenantId, id);
  }

  /** Se la envía a quien la arma (su propio WhatsApp), tal como le llegará a un cliente. */
  public async test(actor: BroadcastActor, body: unknown): Promise<SendOutcome> {
    const input = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const content = requireContent(input["content"]);
    const phone = typeof input["phone"] === "string" ? input["phone"].replace(/\D/g, "") : "";
    if (!/^[0-9]{8,15}$/.test(phone)) throw new ValidationError("Escribe tu número con el código del país, por ejemplo 573001234567.");
    const connectionId = typeof input["connectionId"] === "string" ? input["connectionId"] : "";
    await this.requireNumbers(actor.tenantId, [connectionId]);
    await this.requireFlows(actor.tenantId, [content]);
    const target = { contactId: null, name: null, phone, connectionId };
    if (content.kind === "flow") return this.engine.sender.sendFlow(actor.tenantId, target, content.automationId);
    const business = (await this.engine.business?.(actor.tenantId)) ?? {};
    return this.engine.sender.sendMessage(actor.tenantId, target, { text: personalize(content.text, { name: null, phone }, input["optOutFooter"] !== false, business), media: content.media });
  }

  private async summary(tenantId: string, id: string): Promise<BroadcastSummary> {
    const broadcast = await this.require(tenantId, id);
    const [stats, names] = await Promise.all([this.engine.results.stats(tenantId, [id]), this.names(tenantId, [broadcast])]);
    return toSummary(broadcast, stats.get(id), names);
  }

  private async require(tenantId: string, id: string): Promise<Broadcast> {
    const broadcast = await this.engine.broadcasts.find(tenantId, id);
    if (!broadcast) throw new NotFoundError("Esa difusión no existe.");
    return broadcast;
  }

  private async names(tenantId: string, list: ReadonlyArray<Broadcast>) {
    const [numbers, flows] = await Promise.all([this.engine.numbers.list(tenantId), this.engine.flows.find(tenantId, flowIdsOf(list))]);
    const parents = list.filter((item) => item.parentId).map((item) => item.parentId!);
    const parentNames = new Map<string, string>();
    for (const parentId of new Set(parents)) {
      const parent = list.find((item) => item.id === parentId) ?? (await this.engine.broadcasts.find(tenantId, parentId));
      if (parent) parentNames.set(parentId, parent.name);
    }
    return { numbers: new Map(numbers.map((number) => [number.id, number.name])), flows, broadcasts: parentNames };
  }

  private async requireNumbers(tenantId: string, ids: ReadonlyArray<string>): Promise<void> {
    const numbers = await this.engine.numbers.list(tenantId);
    for (const id of ids) {
      const number = numbers.find((item) => item.id === id);
      if (!number) throw new ValidationError("Ese número ya no existe en tu cuenta.");
      if (!number.canBroadcast) throw new ValidationError(`«${number.name}» es de la API oficial: allí las difusiones necesitan plantillas aprobadas por Meta (llegan pronto).`);
      if (!number.connected) throw new ValidationError(`«${number.name}» no está conectado. Vincúlalo en Conexiones.`);
    }
  }

  private async requireFlows(tenantId: string, contents: ReadonlyArray<BroadcastContent>): Promise<void> {
    const ids = contents.flatMap((content) => (content.kind === "flow" ? [content.automationId] : []));
    if (ids.length === 0) return;
    const found = await this.engine.flows.find(tenantId, ids);
    for (const id of ids) {
      const flow = found.get(id);
      if (!flow) throw new ValidationError("Ese flujo no existe en tu cuenta.");
      if (flow.archived) throw new ValidationError(`«${flow.name}» está archivado: restáuralo para enviarlo.`);
    }
  }
}
