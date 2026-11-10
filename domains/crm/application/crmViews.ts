import type { PipelineSummary } from "../../../contracts/CrmContracts";
import type { CrmEventSummary, FollowUpSummary } from "../../../contracts/CrmActivityContracts";
import type { Pipeline } from "../domain/Pipeline";
import type { CrmEventRecord, FollowUpView } from "./CrmRepositories";

// Lo que sale por la API a partir de lo guardado.

/** Quién actúa en el CRM. Qué puede lo deciden sus permisos (`crm.*`). */
export interface CrmActor {
  readonly tenantId: string;
  readonly userId: string;
  readonly canWrite: boolean;
  readonly canManage: boolean;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toPipelineSummary(pipeline: Pipeline): PipelineSummary {
  return {
    id: pipeline.id,
    name: pipeline.name,
    stages: [...pipeline.stages]
      .sort((a, b) => a.position - b.position)
      .map((stage) => ({ id: stage.id, labelId: stage.labelId, name: stage.name, color: stage.color, outcome: stage.outcome, position: stage.position })),
    entryStageId: pipeline.entryStageId,
    saleStageId: pipeline.saleStageId,
    defaultProductId: pipeline.defaultProductId,
    autoAssign: pipeline.autoAssign
  };
}

export function toFollowUpSummary(view: FollowUpView): FollowUpSummary {
  return {
    id: view.id,
    contactId: view.contactId,
    contactName: view.contactName,
    title: view.title,
    dueAt: view.dueAt,
    assigneeId: view.assigneeId,
    assigneeName: view.assigneeName,
    doneAt: view.doneAt,
    doneByName: view.doneByName
  };
}

export function toEventSummary(event: CrmEventRecord): CrmEventSummary {
  return {
    id: event.id,
    kind: event.kind,
    pipelineId: event.pipelineId,
    fromStageId: event.fromStageId,
    toStageId: event.toStageId,
    source: event.source,
    actorName: event.actorName,
    flowName: event.flowName,
    detail: event.detail,
    createdAt: event.createdAt
  };
}
