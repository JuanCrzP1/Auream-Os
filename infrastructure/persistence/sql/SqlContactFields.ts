import type { ContactFieldDefinition, ContactFieldType } from "../../../contracts/ContactFieldContracts";
import type { ContactFieldRepository, ContactFieldValues } from "../../../domains/contact-fields/application/ContactFieldPorts";
import type { FieldShape } from "../../../domains/contact-fields/domain/ContactField";
import type { ObservedValues } from "../../../domains/contact-fields/domain/fieldDiscovery";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Campos del cliente en PostgreSQL: el catálogo (`contact_field_definitions`)
// y los valores, que viven en `contacts.custom_fields` con la misma clave.
// Todo filtra por cuenta.
// ---------------------------------------------------------------------------

interface Row {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: ContactFieldType;
  readonly options: string[];
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

const toDefinition = (row: Row): ContactFieldDefinition => ({
  id: row.id,
  key: row.key,
  label: row.label,
  type: row.type,
  options: row.options ?? [],
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const COLUMNS = "id, key, label, type, options, created_at, updated_at";
/** Cuántos valores distintos se miran por clave para proponer su tipo. */
const TOP_VALUES = 40;

export class SqlContactFieldRepository implements ContactFieldRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string): Promise<ContactFieldDefinition[]> {
    const { rows } = await this.sql.query<Row>(`select ${COLUMNS} from contact_field_definitions where tenant_id = $1 order by created_at, key`, [tenantId]);
    return rows.map(toDefinition);
  }

  public async find(tenantId: string, id: string): Promise<ContactFieldDefinition | null> {
    if (!isUuid(id)) return null;
    const { rows } = await this.sql.query<Row>(`select ${COLUMNS} from contact_field_definitions where tenant_id = $1 and id = $2`, [tenantId, id]);
    return rows[0] ? toDefinition(rows[0]) : null;
  }

  public async create(tenantId: string, id: string, field: FieldShape): Promise<ContactFieldDefinition | null> {
    const { rows } = await this.sql.query<Row>(
      `insert into contact_field_definitions (id, tenant_id, key, label, type, options) values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (tenant_id, key) do nothing returning ${COLUMNS}`,
      [id, tenantId, field.key, field.label, field.type, JSON.stringify(field.options)]
    );
    return rows[0] ? toDefinition(rows[0]) : null;
  }

  public async update(tenantId: string, id: string, field: FieldShape): Promise<ContactFieldDefinition | null> {
    const { rows } = await this.sql.query<Row>(
      `update contact_field_definitions set label = $3, type = $4, options = $5::jsonb, updated_at = now()
        where tenant_id = $1 and id = $2 returning ${COLUMNS}`,
      [tenantId, id, field.label, field.type, JSON.stringify(field.options)]
    );
    return rows[0] ? toDefinition(rows[0]) : null;
  }

  public async remove(tenantId: string, id: string, key: string): Promise<boolean> {
    return this.sql.transaction(async (tx) => {
      const deleted = await tx.query(`delete from contact_field_definitions where tenant_id = $1 and id = $2`, [tenantId, id]);
      if (deleted.rowCount === 0) return false;
      await tx.query(`update contacts set custom_fields = custom_fields - $2, updated_at = now() where tenant_id = $1 and custom_fields ? $2`, [tenantId, key]);
      return true;
    });
  }
}

export class SqlContactFieldValues implements ContactFieldValues {
  public constructor(private readonly sql: SqlClient) {}

  public async totalContacts(tenantId: string): Promise<number> {
    const { rows } = await this.sql.query<{ count: string }>(`select count(*) as count from contacts where tenant_id = $1`, [tenantId]);
    return Number(rows[0]?.count ?? 0);
  }

  public async filledCounts(tenantId: string, keys: ReadonlyArray<string>): Promise<ReadonlyMap<string, number>> {
    if (keys.length === 0) return new Map();
    const { rows } = await this.sql.query<{ key: string; count: string }>(
      `select k.key, count(*) as count
         from contacts c cross join lateral jsonb_object_keys(c.custom_fields) as k(key)
        where c.tenant_id = $1 and k.key = any($2::text[]) and c.custom_fields ->> k.key <> ''
        group by k.key`,
      [tenantId, [...keys]]
    );
    return new Map(rows.map((row) => [row.key, Number(row.count)]));
  }

  public async observed(tenantId: string): Promise<ReadonlyMap<string, ObservedValues>> {
    const { rows } = await this.sql.query<{ key: string; filled: string; distinct: string; top: Array<{ value: string; count: number }> }>(
      `with v as (
         select e.key, e.value #>> '{}' as value
           from contacts c cross join lateral jsonb_each(c.custom_fields) as e(key, value)
          where c.tenant_id = $1 and jsonb_typeof(e.value) in ('string', 'number', 'boolean') and e.value #>> '{}' <> ''
       ), counted as (
         select key, value, count(*) as n, row_number() over (partition by key order by count(*) desc, value) as rank
           from v group by key, value
       )
       select key, sum(n) as filled, count(*) as distinct,
              coalesce(jsonb_agg(jsonb_build_object('value', value, 'count', n) order by n desc) filter (where rank <= $2), '[]') as top
         from counted group by key`,
      [tenantId, TOP_VALUES]
    );
    return new Map(rows.map((row) => [row.key, { filled: Number(row.filled), distinct: Number(row.distinct), top: row.top.map((entry) => ({ value: entry.value, count: Number(entry.count) })) }]));
  }

  public async merge(tenantId: string, contactId: string, values: Readonly<Record<string, string | number | boolean>>): Promise<void> {
    if (!isUuid(contactId) || Object.keys(values).length === 0) return;
    await this.sql.query(`update contacts set custom_fields = custom_fields || $3::jsonb, updated_at = now() where tenant_id = $1 and id = $2`, [
      tenantId,
      contactId,
      JSON.stringify(values)
    ]);
  }
}
