import { businessValuesOf, type BusinessDataType, type BusinessDatum } from "../../../contracts/BusinessDataContracts";
import type { ContactFieldValue } from "../../../contracts/ContactContracts";
import type { BusinessDataRepository, BusinessValuesCache } from "../../../domains/business-data/application/BusinessDataPorts";
import type { DatumShape } from "../../../domains/business-data/domain/BusinessDatum";
import type { BusinessDataReader } from "../../../flow-engine/ports/BusinessDataReader";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Datos del negocio en PostgreSQL (`business_data`), y los valores que lee el
// motor en cada turno: guardados unos segundos por cuenta (un turno no paga
// una consulta) y olvidados en cuanto alguien los cambia en este servidor. En
// otro servidor el cambio llega a más tardar en `ttlMs`.
// ---------------------------------------------------------------------------

interface Row {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: BusinessDataType;
  readonly value: string;
  readonly description: string;
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
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const COLUMNS = "id, key, label, type, value, description, created_at, updated_at";

export class SqlBusinessDataRepository implements BusinessDataRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async list(tenantId: string): Promise<BusinessDatum[]> {
    const { rows } = await this.sql.query<Row>(`select ${COLUMNS} from business_data where tenant_id = $1 order by created_at, key`, [tenantId]);
    return rows.map(toDatum);
  }

  public async find(tenantId: string, id: string): Promise<BusinessDatum | null> {
    if (!isUuid(id)) return null;
    const { rows } = await this.sql.query<Row>(`select ${COLUMNS} from business_data where tenant_id = $1 and id = $2`, [tenantId, id]);
    return rows[0] ? toDatum(rows[0]) : null;
  }

  public async create(tenantId: string, id: string, datum: DatumShape, actorId: string): Promise<BusinessDatum | null> {
    const { rows } = await this.sql.query<Row>(
      `insert into business_data (id, tenant_id, key, label, type, value, description, updated_by) values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (tenant_id, key) do nothing returning ${COLUMNS}`,
      [id, tenantId, datum.key, datum.label, datum.type, datum.value, datum.description, actorId]
    );
    return rows[0] ? toDatum(rows[0]) : null;
  }

  public async update(tenantId: string, id: string, datum: DatumShape, actorId: string): Promise<BusinessDatum | null> {
    const { rows } = await this.sql.query<Row>(
      `update business_data set label = $3, type = $4, value = $5, description = $6, updated_by = $7, updated_at = now()
        where tenant_id = $1 and id = $2 returning ${COLUMNS}`,
      [tenantId, id, datum.label, datum.type, datum.value, datum.description, actorId]
    );
    return rows[0] ? toDatum(rows[0]) : null;
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    const deleted = await this.sql.query(`delete from business_data where tenant_id = $1 and id = $2`, [tenantId, id]);
    return (deleted.rowCount ?? 0) > 0;
  }
}

const DEFAULT_TTL_MS = 15_000;

/** Los valores con su tipo, por cuenta, para el motor. Sin base, los últimos conocidos (o ninguno): un turno nunca se cae por esto. */
export class SqlBusinessValues implements BusinessDataReader, BusinessValuesCache {
  private readonly cache = new Map<string, { readonly values: Readonly<Record<string, ContactFieldValue>>; readonly at: number }>();

  public constructor(
    private readonly repository: Pick<BusinessDataRepository, "list">,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  public async values(tenantId: string): Promise<Readonly<Record<string, ContactFieldValue>>> {
    const cached = this.cache.get(tenantId);
    if (cached && this.now() - cached.at < this.ttlMs) return cached.values;
    try {
      const values = businessValuesOf(await this.repository.list(tenantId));
      this.cache.set(tenantId, { values, at: this.now() });
      return values;
    } catch {
      return cached?.values ?? {};
    }
  }

  public forget(tenantId: string): void {
    this.cache.delete(tenantId);
  }
}
