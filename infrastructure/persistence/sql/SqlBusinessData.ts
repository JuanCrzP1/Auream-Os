import { randomUUID } from "node:crypto";
import { businessValuesOf, type BusinessDataType, type BusinessDatum } from "../../../contracts/BusinessDataContracts";
import type { BusinessDataChange } from "../../../contracts/BusinessDataTimeline";
import type { ContactFieldValue } from "../../../contracts/ContactContracts";
import type { BusinessDataRepository, BusinessValuesCache, DatumLog, ScheduleSaved } from "../../../domains/business-data/application/BusinessDataPorts";
import type { DatumShape } from "../../../domains/business-data/domain/BusinessDatum";
import type { ScheduleShape } from "../../../domains/business-data/domain/DatumSchedule";
import type { BusinessDataReader } from "../../../flow-engine/ports/BusinessDataReader";
import type { SqlClient } from "./SqlClient";
import { closeSchedule, history, OPEN_SCHEDULES_SQL, saveSchedule, toSchedules, writeLog } from "./SqlBusinessDataTimeline";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Datos del negocio en PostgreSQL (`business_data`, con sus cambios
// programados e historial en `SqlBusinessDataTimeline`), y los valores que lee
// el motor en cada turno: guardados unos segundos por cuenta (un turno no paga
// una consulta) y olvidados en cuanto alguien los cambia en este servidor. En
// otro servidor un cambio a mano llega a más tardar en `ttlMs`; uno programado,
// justo a su hora.
// ---------------------------------------------------------------------------

interface Row {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: BusinessDataType;
  readonly value: string;
  readonly description: string;
  readonly schedules: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

const toDatum = (row: Row): BusinessDatum => ({
  id: row.id,
  key: row.key,
  label: row.label,
  type: row.type,
  value: row.value,
  description: row.description,
  schedules: toSchedules(row.schedules),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const SELECT = `select d.id, d.key, d.label, d.type, d.value, d.description, ${OPEN_SCHEDULES_SQL} as schedules, d.created_at, d.updated_at from business_data d`;

export class SqlBusinessDataRepository implements BusinessDataRepository {
  public constructor(
    private readonly sql: SqlClient,
    private readonly newId: () => string = randomUUID
  ) {}

  public async list(tenantId: string): Promise<BusinessDatum[]> {
    const { rows } = await this.sql.query<Row>(`${SELECT} where d.tenant_id = $1 order by d.created_at, d.key`, [tenantId]);
    return rows.map(toDatum);
  }

  public async find(tenantId: string, id: string): Promise<BusinessDatum | null> {
    if (!isUuid(id)) return null;
    const { rows } = await this.sql.query<Row>(`${SELECT} where d.tenant_id = $1 and d.id = $2`, [tenantId, id]);
    return rows[0] ? toDatum(rows[0]) : null;
  }

  public async create(tenantId: string, id: string, datum: DatumShape, log: DatumLog): Promise<BusinessDatum | null> {
    const created = await this.sql.transaction(async (tx) => {
      const inserted = await tx.query(
        `insert into business_data (id, tenant_id, key, label, type, value, description, updated_by) values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (tenant_id, key) do nothing`,
        [id, tenantId, datum.key, datum.label, datum.type, datum.value, datum.description, log.actorId]
      );
      if (inserted.rowCount === 0) return false;
      await writeLog(tx, tenantId, datum, log, this.newId);
      return true;
    });
    return created ? this.find(tenantId, id) : null;
  }

  public async update(tenantId: string, id: string, datum: DatumShape, log: DatumLog): Promise<BusinessDatum | null> {
    if (!isUuid(id)) return null;
    const updated = await this.sql.transaction(async (tx) => {
      const changed = await tx.query(
        `update business_data set label = $3, type = $4, value = $5, description = $6, updated_by = $7, updated_at = now() where tenant_id = $1 and id = $2`,
        [tenantId, id, datum.label, datum.type, datum.value, datum.description, log.actorId]
      );
      if (changed.rowCount === 0) return false;
      await writeLog(tx, tenantId, datum, log, this.newId);
      return true;
    });
    return updated ? this.find(tenantId, id) : null;
  }

  public async remove(tenantId: string, id: string, log: DatumLog): Promise<boolean> {
    if (!isUuid(id)) return false;
    return this.sql.transaction(async (tx) => {
      const { rows } = await tx.query<{ key: string; type: BusinessDataType }>(`delete from business_data where tenant_id = $1 and id = $2 returning key, type`, [tenantId, id]);
      if (!rows[0]) return false;
      await writeLog(tx, tenantId, rows[0], log, this.newId);
      return true;
    });
  }

  public saveSchedule(tenantId: string, datumId: string, scheduleId: string, schedule: ScheduleShape, log: DatumLog): Promise<ScheduleSaved> {
    return this.sql.transaction((tx) => saveSchedule(tx, tenantId, datumId, scheduleId, schedule, log, this.newId));
  }

  public closeSchedule(tenantId: string, datumId: string, scheduleId: string, how: "unscheduled" | "ended", at: Date, log: DatumLog): Promise<boolean> {
    return this.sql.transaction((tx) => closeSchedule(tx, tenantId, datumId, scheduleId, how, at, log, this.newId));
  }

  public history(tenantId: string, key: string, limit: number): Promise<BusinessDataChange[]> {
    return history(this.sql, tenantId, key, limit);
  }
}

const DEFAULT_TTL_MS = 15_000;

type Stored = Pick<BusinessDatum, "key" | "type" | "value"> & { readonly schedules?: BusinessDatum["schedules"] };

/**
 * Los valores con su tipo, por cuenta, para el motor. Se guardan los DATOS
 * (con sus cambios programados) y el valor se decide en cada lectura: un
 * cambio de Navidad entra y sale justo a su hora, no 15 s después. Sin base,
 * los últimos conocidos (o ninguno): un turno nunca se cae por esto.
 */
export class SqlBusinessValues implements BusinessDataReader, BusinessValuesCache {
  private readonly cache = new Map<string, { readonly data: ReadonlyArray<Stored>; readonly at: number }>();

  public constructor(
    private readonly repository: { list(tenantId: string): Promise<ReadonlyArray<Stored>> },
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  public async values(tenantId: string): Promise<Readonly<Record<string, ContactFieldValue>>> {
    return businessValuesOf(await this.data(tenantId), new Date(this.now()));
  }

  public forget(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  private async data(tenantId: string): Promise<ReadonlyArray<Stored>> {
    const cached = this.cache.get(tenantId);
    if (cached && this.now() - cached.at < this.ttlMs) return cached.data;
    try {
      const data = await this.repository.list(tenantId);
      this.cache.set(tenantId, { data, at: this.now() });
      return data;
    } catch {
      return cached?.data ?? [];
    }
  }
}
