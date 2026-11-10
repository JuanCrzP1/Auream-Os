import { FOLLOW_UP_BUCKETS, type FollowUpBucket, type FollowUpListResponse, type FollowUpSummary, type SaveFollowUpRequest, type UpdateFollowUpRequest } from "../../../contracts/CrmActivityContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { dayBounds, requireDueAt, requireFollowUpTitle, type FollowUp } from "../domain/FollowUp";
import type { ContactLabeler, CrmTeamDirectory } from "./CrmGateways";
import type { FollowUpRepository } from "./CrmRepositories";
import { UUID, toFollowUpSummary, type CrmActor } from "./crmViews";

// ---------------------------------------------------------------------------
// Seguimientos: «llamar mañana a las 3 p. m.», con su responsable. Se ven en
// Vencidos · Hoy · Próximos (el día de la empresa) y en la ficha del cliente.
// Crear, marcar como hecho y cambiar uno es de quien atiende (`crm.write`).
// ---------------------------------------------------------------------------

const PAGE = 100;

export interface FollowUpFilters {
  readonly bucket?: string;
  /** `all`: los de todo el equipo; si no, los de quien pregunta. */
  readonly assignee?: string;
}

export class FollowUpServices {
  public constructor(
    private readonly followUps: FollowUpRepository,
    private readonly labeler: ContactLabeler,
    private readonly team: CrmTeamDirectory,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async list(actor: CrmActor, filters: FollowUpFilters): Promise<FollowUpListResponse> {
    const now = this.now();
    const { end } = dayBounds(now, await this.timezoneOf(actor.tenantId));
    const assigneeId = filters.assignee === "all" ? null : actor.userId;
    const bucket: FollowUpBucket = FOLLOW_UP_BUCKETS.includes(filters.bucket as FollowUpBucket) ? (filters.bucket as FollowUpBucket) : "today";
    const [followUps, counts] = await Promise.all([
      this.followUps.list(actor.tenantId, { bucket, assigneeId, now, endOfToday: end, limit: PAGE }),
      this.followUps.counts(actor.tenantId, { assigneeId, now, endOfToday: end })
    ]);
    return { followUps: followUps.map(toFollowUpSummary), counts };
  }

  public async create(actor: CrmActor, input: Partial<SaveFollowUpRequest>): Promise<FollowUpSummary> {
    const contactId = typeof input.contactId === "string" && UUID.test(input.contactId) ? input.contactId : null;
    if (!contactId || !(await this.labeler.snapshot(actor.tenantId, contactId))) throw new NotFoundError("Ese cliente no existe.");
    const followUp: FollowUp = {
      id: crypto.randomUUID(),
      tenantId: actor.tenantId,
      contactId,
      title: requireFollowUpTitle(input.title),
      dueAt: requireDueAt(input.dueAt, this.now()).toISOString(),
      assigneeId: input.assigneeId === undefined ? actor.userId : await this.requireAssignee(actor.tenantId, input.assigneeId),
      createdBy: actor.userId,
      doneAt: null,
      doneBy: null
    };
    await this.followUps.insert(followUp);
    return this.summary(actor.tenantId, followUp.id);
  }

  public async update(actor: CrmActor, id: string, input: Partial<UpdateFollowUpRequest>): Promise<FollowUpSummary> {
    const current = UUID.test(id) ? await this.followUps.find(actor.tenantId, id) : null;
    if (!current) throw new NotFoundError("Ese seguimiento no existe.");
    const done = input.done === undefined ? current.doneAt !== null : input.done === true;
    await this.followUps.update({
      ...current,
      title: input.title === undefined ? current.title : requireFollowUpTitle(input.title),
      dueAt: input.dueAt === undefined ? current.dueAt : requireDueAt(input.dueAt, this.now()).toISOString(),
      assigneeId: input.assigneeId === undefined ? current.assigneeId : await this.requireAssignee(actor.tenantId, input.assigneeId),
      doneAt: done ? (current.doneAt ?? this.now().toISOString()) : null,
      doneBy: done ? (current.doneBy ?? actor.userId) : null
    });
    return this.summary(actor.tenantId, id);
  }

  public async remove(actor: CrmActor, id: string): Promise<void> {
    if (!UUID.test(id) || !(await this.followUps.remove(actor.tenantId, id))) throw new NotFoundError("Ese seguimiento no existe.");
  }

  private async requireAssignee(tenantId: string, assigneeId: unknown): Promise<string | null> {
    if (assigneeId === null || assigneeId === "") return null;
    const member = (await this.team.members(tenantId)).find((candidate) => candidate.userId === assigneeId && candidate.canSell);
    if (!member) throw new ValidationError("Esa persona no está en el equipo o es de solo lectura.");
    return member.userId;
  }

  private async summary(tenantId: string, id: string): Promise<FollowUpSummary> {
    const saved = await this.followUps.find(tenantId, id);
    if (!saved) throw new NotFoundError("Ese seguimiento no existe.");
    return toFollowUpSummary(saved);
  }
}
