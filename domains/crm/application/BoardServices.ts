import {
  CRM_CARDS_PER_STAGE,
  type BoardFilters,
  type BoardResponse,
  type MoveDealRequest,
  type StageCardsResponse
} from "../../../contracts/CrmContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { pipelineMetrics } from "../domain/PipelineMetrics";
import type { Pipeline } from "../domain/Pipeline";
import type { ContactLabeler } from "./CrmGateways";
import type { BoardQuery, BoardReader } from "./CrmRepositories";
import type { PipelineServices } from "./PipelineServices";
import { UUID, type CrmActor } from "./crmViews";

// ---------------------------------------------------------------------------
// El tablero (y la lista) de un embudo: quién está en cada etapa, con su
// valor, su responsable y su próximo seguimiento, y los números del embudo.
// Mover a alguien de etapa es ponerle la etiqueta de la etapa: Contactos
// quita la anterior del mismo embudo y el CRM anota el resto (StageTracker).
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const MAX_REASON = 200;

export class BoardServices {
  public constructor(
    private readonly pipelines: PipelineServices,
    private readonly board: BoardReader,
    private readonly labeler: ContactLabeler,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async view(actor: CrmActor, pipelineId: string, filters: BoardFilters): Promise<BoardResponse> {
    const pipeline = await this.pipelines.require(actor.tenantId, pipelineId);
    const query = queryOf(actor, filters);
    const now = this.now();
    const [counts, cards, won] = await Promise.all([
      this.board.counts(actor.tenantId, pipeline, query),
      this.board.cards(actor.tenantId, pipeline, pipeline.stages.map((stage) => stage.id), query, 0, CRM_CARDS_PER_STAGE),
      this.board.won(actor.tenantId, pipeline.id, new Date(now.getTime() - 30 * DAY_MS), new Date(now.getTime() - 90 * DAY_MS))
    ]);
    const byStage = new Map(counts.map((count) => [count.stageId, count]));
    const openIds = new Set(pipeline.stages.filter((stage) => stage.outcome === "open").map((stage) => stage.id));
    return {
      pipelineId: pipeline.id,
      columns: [...pipeline.stages]
        .sort((a, b) => a.position - b.position)
        .map((stage) => ({
          stageId: stage.id,
          count: byStage.get(stage.id)?.count ?? 0,
          totals: byStage.get(stage.id)?.totals ?? [],
          cards: cards.filter((card) => card.stageId === stage.id)
        })),
      metrics: pipelineMetrics(pipeline, {
        counts: new Map(counts.map((count) => [count.stageId, count.count])),
        openTotals: sumByCurrency(counts.filter((count) => openIds.has(count.stageId)).flatMap((count) => count.totals)),
        wonTotals: won.totals,
        wonCount: won.count,
        avgDaysToClose: won.avgDays
      })
    };
  }

  /** Más clientes de una etapa (la lista y «ver más» del tablero). */
  public async stageCards(actor: CrmActor, pipelineId: string, stageId: string, filters: BoardFilters, offset: number): Promise<StageCardsResponse> {
    const pipeline = await this.pipelines.require(actor.tenantId, pipelineId);
    const stage = requireStage(pipeline, stageId);
    const start = Number.isInteger(offset) && offset > 0 ? Math.min(offset, 100_000) : 0;
    const cards = await this.board.cards(actor.tenantId, pipeline, [stage.id], queryOf(actor, filters), start, CRM_CARDS_PER_STAGE + 1);
    return { cards: cards.slice(0, CRM_CARDS_PER_STAGE), nextOffset: cards.length > CRM_CARDS_PER_STAGE ? start + CRM_CARDS_PER_STAGE : null };
  }

  /** Pasar a un cliente a una etapa (también lo suma al embudo si no estaba). */
  public async move(actor: CrmActor, pipelineId: string, contactId: string, input: Partial<MoveDealRequest>): Promise<void> {
    const pipeline = await this.pipelines.require(actor.tenantId, pipelineId);
    const stage = requireStage(pipeline, input.stageId);
    await this.requireContact(actor.tenantId, contactId);
    const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, MAX_REASON) : "";
    await this.labeler.change(actor.tenantId, contactId, { add: [stage.labelId], remove: [] }, {
      kind: "user",
      userId: actor.userId,
      note: stage.outcome === "lost" && reason ? reason : null
    });
  }

  /** Sacar a un cliente del embudo (le quita la etiqueta de su etapa; el contacto queda). */
  public async remove(actor: CrmActor, pipelineId: string, contactId: string): Promise<void> {
    const pipeline = await this.pipelines.require(actor.tenantId, pipelineId);
    await this.requireContact(actor.tenantId, contactId);
    await this.labeler.change(actor.tenantId, contactId, { add: [], remove: pipeline.stages.map((stage) => stage.labelId) }, { kind: "user", userId: actor.userId });
  }

  private async requireContact(tenantId: string, contactId: string): Promise<void> {
    if (!UUID.test(contactId) || !(await this.labeler.snapshot(tenantId, contactId))) throw new NotFoundError("Ese cliente no existe.");
  }
}

export function requireStage(pipeline: Pipeline, stageId: unknown) {
  const stage = pipeline.stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new ValidationError("Esa etapa no es de este embudo.");
  return stage;
}

function queryOf(actor: CrmActor, filters: BoardFilters): BoardQuery {
  const owner = filters.owner === "me" ? actor.userId : filters.owner === "none" ? "none" : filters.owner && UUID.test(filters.owner) ? filters.owner : undefined;
  const search = filters.search?.trim();
  return { ...(owner ? { ownerId: owner } : {}), ...(search && search.length >= 2 ? { search: search.slice(0, 80) } : {}) };
}

function sumByCurrency(values: ReadonlyArray<{ amount: number; currency: string }>) {
  const totals = new Map<string, number>();
  for (const value of values) totals.set(value.currency, (totals.get(value.currency) ?? 0) + value.amount);
  return [...totals].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
}
