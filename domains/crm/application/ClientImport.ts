import { MAX_IMPORT_PER_RUN, type ImportClientsResponse } from "../../../contracts/CrmContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { ContactLabeler } from "./CrmGateways";
import type { CrmActor } from "./crmViews";
import type { PipelineServices } from "./PipelineServices";

// ---------------------------------------------------------------------------
// Traer al embudo a los clientes que ya tienes: los que escribieron en los
// últimos días (o todos) y aún no están en él entran a la etapa de entrada,
// como si acabaran de escribir (con su valor por defecto y su responsable
// por turnos, si el embudo los da). Primero se ve cuántos son.
// ---------------------------------------------------------------------------

/** Contactos con chat que no tienen ninguna etapa del embudo (los candidatos a entrar). */
export interface ImportCandidates {
  count(tenantId: string, excludeLabelIds: ReadonlyArray<string>, since: Date | null): Promise<number>;
  /** Los más recientes primero. */
  list(tenantId: string, excludeLabelIds: ReadonlyArray<string>, since: Date | null, limit: number): Promise<ReadonlyArray<string>>;
}

const MAX_DAYS = 3650;

function sinceOf(days: unknown, now: Date): Date | null {
  if (days === null || days === undefined) return null;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > MAX_DAYS) throw new ValidationError("Elige desde cuándo traer a los clientes.");
  return new Date(now.getTime() - days * 86_400_000);
}

export class ClientImport {
  public constructor(
    private readonly pipelines: Pick<PipelineServices, "require">,
    private readonly candidates: ImportCandidates,
    private readonly labeler: ContactLabeler,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** Cuántos entrarían. */
  public async preview(actor: CrmActor, pipelineId: string, days: unknown): Promise<ImportClientsResponse> {
    const { stageLabels } = await this.entry(actor, pipelineId);
    return { count: await this.candidates.count(actor.tenantId, stageLabels, sinceOf(days, this.now())) };
  }

  /** Los trae (hasta `MAX_IMPORT_PER_RUN` por vez) y dice cuántos faltan. */
  public async run(actor: CrmActor, pipelineId: string, days: unknown): Promise<ImportClientsResponse> {
    const { stageLabels, entryLabel } = await this.entry(actor, pipelineId);
    const since = sinceOf(days, this.now());
    const contactIds = await this.candidates.list(actor.tenantId, stageLabels, since, MAX_IMPORT_PER_RUN);
    for (const contactId of contactIds) {
      await this.labeler.change(actor.tenantId, contactId, { add: [entryLabel], remove: [] }, { kind: "user", userId: actor.userId });
    }
    return { count: contactIds.length, remaining: await this.candidates.count(actor.tenantId, stageLabels, since) };
  }

  private async entry(actor: CrmActor, pipelineId: string) {
    const pipeline = await this.pipelines.require(actor.tenantId, pipelineId);
    const entryLabel = pipeline.stages.find((stage) => stage.id === pipeline.entryStageId)?.labelId;
    if (!entryLabel) throw new ValidationError("Elige primero en qué etapa entran los clientes (Configurar el embudo).");
    return { entryLabel, stageLabels: pipeline.stages.map((stage) => stage.labelId) };
  }
}
