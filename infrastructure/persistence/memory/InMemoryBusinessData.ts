import type { BusinessDataType, BusinessDatum } from "../../../contracts/BusinessDataContracts";
import { BUSINESS_HISTORY_LIMIT, type BusinessDataChange, type BusinessDataSchedule } from "../../../contracts/BusinessDataTimeline";
import type { BusinessDataRepository, DatumLog, ScheduleSaved } from "../../../domains/business-data/application/BusinessDataPorts";
import type { DatumShape } from "../../../domains/business-data/domain/BusinessDatum";
import type { ScheduleShape } from "../../../domains/business-data/domain/DatumSchedule";

// Datos del negocio en memoria (pruebas y almacén sin base), con sus cambios
// programados y su historial. Cada cuenta ve solo los suyos.

type Row = Omit<BusinessDatum, "schedules"> & { readonly tenantId: string };
type ScheduleRow = BusinessDataSchedule & { readonly tenantId: string; readonly datumId: string };

export class InMemoryBusinessDataRepository implements BusinessDataRepository {
  private readonly rows = new Map<string, Row>();
  private readonly schedules = new Map<string, ScheduleRow>();
  private readonly changes: Array<BusinessDataChange & { readonly tenantId: string; readonly key: string }> = [];
  private clock = 0;

  public constructor(private readonly now: () => Date = () => new Date()) {}

  public async list(tenantId: string): Promise<BusinessDatum[]> {
    return [...this.rows.values()].filter((row) => row.tenantId === tenantId).map((row) => this.toDatum(row));
  }

  public async find(tenantId: string, id: string): Promise<BusinessDatum | null> {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? this.toDatum(row) : null;
  }

  public async create(tenantId: string, id: string, datum: DatumShape, log: DatumLog): Promise<BusinessDatum | null> {
    if ([...this.rows.values()].some((row) => row.tenantId === tenantId && row.key === datum.key)) return null;
    const at = this.tick();
    this.rows.set(id, { ...datum, id, tenantId, createdAt: at, updatedAt: at });
    this.log(tenantId, datum, log);
    return this.find(tenantId, id);
  }

  public async update(tenantId: string, id: string, datum: DatumShape, log: DatumLog): Promise<BusinessDatum | null> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return null;
    this.rows.set(id, { ...row, ...datum, key: row.key, updatedAt: this.tick() });
    this.log(tenantId, datum, log);
    return this.find(tenantId, id);
  }

  public async remove(tenantId: string, id: string, log: DatumLog): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return false;
    this.rows.delete(id);
    for (const [scheduleId, schedule] of this.schedules) if (schedule.datumId === id) this.schedules.delete(scheduleId);
    this.log(tenantId, row, log);
    return true;
  }

  public async saveSchedule(tenantId: string, datumId: string, scheduleId: string, schedule: ScheduleShape, log: DatumLog): Promise<ScheduleSaved> {
    const row = this.rows.get(datumId);
    const current = this.schedules.get(scheduleId);
    if (!row || row.tenantId !== tenantId || (current && current.datumId !== datumId)) return "missing";
    const [startsAt, endsAt] = [schedule.startsAt.toISOString(), schedule.endsAt.toISOString()];
    const clash = [...this.open(datumId)].some((other) => other.id !== scheduleId && other.startsAt < endsAt && startsAt < other.endsAt);
    if (clash) return "overlap";
    this.schedules.set(scheduleId, { id: scheduleId, tenantId, datumId, value: schedule.value, startsAt, endsAt, note: schedule.note, createdBy: current?.createdBy ?? null, createdAt: current?.createdAt ?? this.tick() });
    this.log(tenantId, row, log);
    return "saved";
  }

  public async closeSchedule(tenantId: string, datumId: string, scheduleId: string, how: "unscheduled" | "ended", at: Date, log: DatumLog): Promise<boolean> {
    const row = this.rows.get(datumId);
    const current = this.schedules.get(scheduleId);
    if (!row || row.tenantId !== tenantId || !current || current.datumId !== datumId) return false;
    if (how === "unscheduled") this.schedules.delete(scheduleId);
    else this.schedules.set(scheduleId, { ...current, endsAt: at.toISOString() });
    this.log(tenantId, row, log);
    return true;
  }

  public async history(tenantId: string, key: string, limit: number): Promise<BusinessDataChange[]> {
    return this.changes
      .filter((change) => change.tenantId === tenantId && change.key === key)
      .reverse()
      .slice(0, limit)
      .map(({ tenantId: _tenant, key: _key, ...change }) => change as BusinessDataChange);
  }

  private open(datumId: string): ScheduleRow[] {
    const now = this.now().toISOString();
    return [...this.schedules.values()].filter((schedule) => schedule.datumId === datumId && schedule.endsAt > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  private toDatum({ tenantId: _tenant, ...row }: Row): BusinessDatum {
    return { ...row, schedules: this.open(row.id).map(({ tenantId: _t, datumId: _d, ...schedule }) => schedule) };
  }

  private log(tenantId: string, datum: { readonly key: string; readonly type: BusinessDataType }, log: DatumLog): void {
    for (const change of log.changes) {
      this.changes.push({ ...change, id: `change-${this.changes.length + 1}`, at: this.tick(), actorName: log.actorId, valueType: datum.type, tenantId, key: datum.key } as BusinessDataChange & { tenantId: string; key: string });
    }
    const mine = this.changes.filter((change) => change.tenantId === tenantId && change.key === datum.key);
    for (const old of mine.slice(0, Math.max(0, mine.length - BUSINESS_HISTORY_LIMIT))) this.changes.splice(this.changes.indexOf(old), 1);
  }

  private tick(): string {
    return new Date(Date.UTC(2026, 10, 13, 0, 0, this.clock++)).toISOString();
  }
}
