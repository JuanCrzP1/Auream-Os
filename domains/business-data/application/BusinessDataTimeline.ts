import type { BusinessDatum } from "../../../contracts/BusinessDataContracts";
import { BUSINESS_HISTORY_LIMIT, scheduleState, type BusinessDataHistoryResponse } from "../../../contracts/BusinessDataTimeline";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { removalOf, requireNewSchedule, requireScheduleChanges, type ScheduleContext } from "../domain/DatumSchedule";
import { scheduleChanged, scheduleSnapshot } from "../domain/datumChanges";
import type { BusinessDataRepository, BusinessValuesCache, ScheduleSaved } from "./BusinessDataPorts";

// ---------------------------------------------------------------------------
// Los cambios programados de un dato del negocio (programar, editar, quitar
// o terminar antes) y su historial. Cada uno deja su línea en el historial en
// la misma operación, y avisa a la memoria de valores: el motor ve el cambio
// en el siguiente mensaje. Lo pide la ruta con `flows.write` (leer el
// historial, `flows.read`). Todo filtra por cuenta.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ScheduleInput = { readonly value?: unknown; readonly from?: unknown; readonly until?: unknown; readonly note?: unknown };

interface TimelineClock {
  readonly newId: () => string;
  readonly now: () => Date;
  readonly timeZoneOf: (tenantId: string) => Promise<string>;
}

export async function requireDatum(repository: Pick<BusinessDataRepository, "find">, tenantId: string, id: string): Promise<BusinessDatum> {
  const current = UUID.test(id) ? await repository.find(tenantId, id) : null;
  if (!current) throw new NotFoundError("Ese dato ya no existe.");
  return current;
}

function requireSaved(result: ScheduleSaved): void {
  if (result === "missing") throw new NotFoundError("Ese cambio programado ya no existe.");
  if (result === "overlap") throw new ValidationError("Alguien programó otro cambio en esas fechas mientras escribías. Revisa la lista y elige otras.");
}

export class BusinessDataTimeline {
  public constructor(
    private readonly repository: BusinessDataRepository,
    private readonly cache: BusinessValuesCache,
    private readonly clock: TimelineClock
  ) {}

  /** Programa otro valor entre dos fechas. Devuelve el dato con sus programados al día. */
  public async schedule(tenantId: string, datumId: string, input: ScheduleInput, actorId: string): Promise<BusinessDatum> {
    const datum = await requireDatum(this.repository, tenantId, datumId);
    const context = await this.context(tenantId, datum);
    const shape = requireNewSchedule(input, context);
    requireSaved(await this.repository.saveSchedule(tenantId, datumId, this.clock.newId(), shape, { actorId, changes: [{ kind: "scheduled", schedule: scheduleSnapshot(shape) }] }));
    return this.done(tenantId, datumId);
  }

  /** Edita uno: entero si no ha empezado; si ya rige, todo menos «desde». */
  public async reschedule(tenantId: string, datumId: string, scheduleId: string, input: ScheduleInput, actorId: string): Promise<BusinessDatum> {
    const datum = await requireDatum(this.repository, tenantId, datumId);
    const current = datum.schedules.find((schedule) => schedule.id === scheduleId);
    if (!current) throw new NotFoundError("Ese cambio programado ya terminó o no existe.");
    const context = await this.context(tenantId, datum, scheduleId);
    const shape = requireScheduleChanges(current, input, context);
    const [before, after] = [scheduleSnapshot(current), scheduleSnapshot(shape)];
    if (!scheduleChanged(before, after)) return datum;
    requireSaved(await this.repository.saveSchedule(tenantId, datumId, scheduleId, shape, { actorId, changes: [{ kind: "rescheduled", before, after }] }));
    return this.done(tenantId, datumId);
  }

  /** Quita uno que no ha empezado, o termina ya uno activo (vuelve el valor de siempre). */
  public async unschedule(tenantId: string, datumId: string, scheduleId: string, actorId: string): Promise<BusinessDatum> {
    const datum = await requireDatum(this.repository, tenantId, datumId);
    const current = datum.schedules.find((schedule) => schedule.id === scheduleId);
    if (!current) throw new NotFoundError("Ese cambio programado ya terminó o no existe.");
    const now = this.clock.now();
    const how = removalOf(current, now);
    const snapshot = how === "ended" ? { ...scheduleSnapshot(current), endsAt: now.toISOString() } : scheduleSnapshot(current);
    const closed = await this.repository.closeSchedule(tenantId, datumId, scheduleId, how, now, { actorId, changes: [{ kind: how, schedule: snapshot }] });
    if (!closed) throw new NotFoundError("Ese cambio programado ya terminó o no existe.");
    return this.done(tenantId, datumId);
  }

  /** Lo último que pasó con el dato (los últimos 50), del más reciente al más viejo. */
  public async history(tenantId: string, datumId: string): Promise<BusinessDataHistoryResponse> {
    const datum = await requireDatum(this.repository, tenantId, datumId);
    return { changes: await this.repository.history(tenantId, datum.key, BUSINESS_HISTORY_LIMIT) };
  }

  private async context(tenantId: string, datum: BusinessDatum, editing?: string): Promise<ScheduleContext> {
    const now = this.clock.now();
    return {
      type: datum.type,
      baseValue: datum.value,
      timezone: await this.clock.timeZoneOf(tenantId),
      now,
      others: datum.schedules.filter((schedule) => schedule.id !== editing && scheduleState(schedule, now) !== "ended")
    };
  }

  private async done(tenantId: string, datumId: string): Promise<BusinessDatum> {
    this.cache.forget(tenantId);
    return requireDatum(this.repository, tenantId, datumId);
  }
}
