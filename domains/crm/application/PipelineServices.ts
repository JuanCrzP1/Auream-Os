import { CRM_PIPELINES_MAX, type PipelineListResponse, type PipelineSummary, type SavePipelineRequest } from "../../../contracts/CrmContracts";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { STARTER_PIPELINE, requirePipelineDraft, type Pipeline, type PipelineDraft } from "../domain/Pipeline";
import type { CrmProductCatalog, CrmTeamDirectory, StageLabels } from "./CrmGateways";
import type { PipelineRepository, StageRecord } from "./CrmRepositories";
import { UUID, toPipelineSummary, type CrmActor } from "./crmViews";

// ---------------------------------------------------------------------------
// Los embudos de la cuenta: verlos (con quién puede ser responsable) y,
// quien puede configurar (`crm.manage`), crearlos, cambiarlos y quitarlos.
//
// Cada etapa es una etiqueta: al guardar, una etapa nueva usa la etiqueta de
// ese nombre si ya existe (sus clientes aparecen de una vez en el tablero) o
// la crea; renombrar o recolorear una etapa cambia su etiqueta. Quitar una
// etapa o un embudo NO borra la etiqueta ni a nadie: solo deja de ser etapa.
// ---------------------------------------------------------------------------

const DEFAULT_STAGE_COLOR = "#6c5ce7";

export class PipelineServices {
  public constructor(
    private readonly pipelines: PipelineRepository,
    private readonly labels: StageLabels,
    private readonly team: CrmTeamDirectory,
    private readonly catalog: CrmProductCatalog
  ) {}

  public async list(actor: CrmActor): Promise<PipelineListResponse> {
    const [pipelines, members] = await Promise.all([this.pipelines.list(actor.tenantId), this.team.members(actor.tenantId)]);
    return {
      pipelines: pipelines.map(toPipelineSummary),
      members: members.filter((member) => member.canSell).map(({ userId, name, photoUrl }) => ({ userId, name, photoUrl })),
      canWrite: actor.canWrite,
      canManage: actor.canManage
    };
  }

  public async create(actor: CrmActor, input: Partial<SavePipelineRequest>): Promise<PipelineSummary> {
    const draft = requirePipelineDraft(input);
    const existing = await this.pipelines.list(actor.tenantId);
    if (existing.length >= CRM_PIPELINES_MAX) throw new ValidationError(`Puedes tener hasta ${CRM_PIPELINES_MAX} embudos.`);
    this.requireUniqueName(existing, draft.name, null);
    return this.store(actor.tenantId, crypto.randomUUID(), draft, null);
  }

  /** El embudo de una venta por WhatsApp, listo para usar (el primero de la cuenta). */
  public async createStarter(actor: CrmActor): Promise<PipelineSummary> {
    const existing = await this.pipelines.list(actor.tenantId);
    const taken = new Set(existing.map((pipeline) => pipeline.name.toLowerCase()));
    let name = STARTER_PIPELINE.name;
    for (let n = 2; taken.has(name.toLowerCase()); n += 1) name = `${STARTER_PIPELINE.name} ${n}`;
    return this.create(actor, { ...STARTER_PIPELINE, name });
  }

  public async update(actor: CrmActor, pipelineId: string, input: Partial<SavePipelineRequest>): Promise<PipelineSummary> {
    const current = await this.require(actor.tenantId, pipelineId);
    const draft = requirePipelineDraft(input);
    this.requireUniqueName(await this.pipelines.list(actor.tenantId), draft.name, pipelineId);
    return this.store(actor.tenantId, pipelineId, draft, current);
  }

  public async remove(actor: CrmActor, pipelineId: string): Promise<void> {
    if (!UUID.test(pipelineId) || !(await this.pipelines.remove(actor.tenantId, pipelineId))) throw new NotFoundError("Ese embudo no existe.");
  }

  public async require(tenantId: string, pipelineId: string): Promise<Pipeline> {
    const pipeline = UUID.test(pipelineId) ? await this.pipelines.find(tenantId, pipelineId) : null;
    if (!pipeline) throw new NotFoundError("Ese embudo no existe.");
    return pipeline;
  }

  private requireUniqueName(existing: ReadonlyArray<Pipeline>, name: string, except: string | null): void {
    if (existing.some((pipeline) => pipeline.id !== except && pipeline.name.toLowerCase() === name.toLowerCase())) {
      throw new ValidationError(`Ya hay un embudo llamado «${name}».`);
    }
  }

  private async store(tenantId: string, pipelineId: string, draft: PipelineDraft, current: Pipeline | null): Promise<PipelineSummary> {
    if (draft.defaultProductId && !(await this.catalog.findActive(tenantId, draft.defaultProductId))) {
      throw new ValidationError("Ese producto no existe o está archivado.");
    }
    const stages: StageRecord[] = [];
    const labelIds = new Set<string>();
    for (const input of draft.stages) {
      const existing = input.id ? current?.stages.find((stage) => stage.id === input.id) : undefined;
      if (input.id && !existing) throw new ValidationError(`La etapa «${input.name}» no es de este embudo.`);
      const labelId = existing ? await this.rename(tenantId, existing.labelId, input.name, input.color ?? existing.color) : await this.labelFor(tenantId, pipelineId, input.name, input.color);
      if (labelIds.has(labelId)) throw new ValidationError(`Hay dos etapas llamadas «${input.name}».`);
      labelIds.add(labelId);
      stages.push({ id: existing?.id ?? crypto.randomUUID(), labelId, outcome: input.outcome });
    }
    const idAt = (index: number | null) => (index === null ? null : stages[index]!.id);
    await this.pipelines.save(tenantId, {
      id: pipelineId,
      name: draft.name,
      stages,
      entryStageId: idAt(draft.entryStage),
      saleStageId: idAt(draft.saleStage),
      defaultProductId: draft.defaultProductId,
      autoAssign: draft.autoAssign,
      entrySource: draft.entrySource
    });
    return toPipelineSummary(await this.require(tenantId, pipelineId));
  }

  /** La etiqueta de una etapa nueva: la de ese nombre (si no es etapa de otro embudo) o una nueva. */
  private async labelFor(tenantId: string, pipelineId: string, name: string, color: string | null): Promise<string> {
    const label = await this.labels.ensure(tenantId, name, color ?? DEFAULT_STAGE_COLOR);
    const usedBy = await this.pipelines.pipelineUsingLabel(tenantId, label.id, pipelineId);
    if (usedBy) throw new ValidationError(`«${label.name}» ya es una etapa del embudo «${usedBy}». Usa otro nombre.`);
    return label.id;
  }

  private async rename(tenantId: string, labelId: string, name: string, color: string): Promise<string> {
    const label = await this.labels.find(tenantId, labelId);
    if (!label) throw new ValidationError(`La etiqueta de la etapa «${name}» ya no existe. Quita la etapa y créala de nuevo.`);
    if (label.name !== name || label.color !== color) {
      try {
        await this.labels.update(tenantId, labelId, name, color);
      } catch (error) {
        if (error instanceof ConflictError) throw new ValidationError(`Ya hay una etiqueta llamada «${name}». Usa otro nombre para la etapa.`);
        throw error;
      }
    }
    return labelId;
  }
}
