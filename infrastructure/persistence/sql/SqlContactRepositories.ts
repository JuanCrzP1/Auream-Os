import type { ContactQuery, ContactRepository, ContactWithLabels, LabelRepository } from "../../../domains/contacts/application/ContactRepository";
import type { Contact } from "../../../domains/contacts/domain/Contact";
import type { Label } from "../../../domains/contacts/domain/Label";
import type { ContactFieldValue } from "../../../contracts/ContactContracts";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import type { SqlClient, SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Contactos y etiquetas en PostgreSQL. Toda consulta filtra por `tenant_id`;
// la asignación contacto↔etiqueta además lo exige con FKs compuestas.
// ---------------------------------------------------------------------------

interface ContactRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly channel: string;
  readonly external_key: string;
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly custom_fields: Record<string, ContactFieldValue>;
  readonly created_at: Date;
  readonly updated_at: Date;
  /** Etiquetas agregadas en la consulta (json). */
  readonly labels: Array<{ id: string; name: string; color: string; created_at: string }> | null;
}

interface LabelRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly color: string;
  readonly created_at: Date;
  readonly contact_count?: string;
}

const CONTACT_SELECT = `
  select c.id, c.tenant_id, c.channel, c.external_key, c.name, c.phone, c.email, c.custom_fields,
         c.created_at, c.updated_at,
         coalesce(json_agg(json_build_object('id', l.id, 'name', l.name, 'color', l.color, 'created_at', l.created_at)
                  order by lower(l.name)) filter (where l.id is not null), '[]') as labels
    from contacts c
    left join contact_label_assignments a on a.contact_id = c.id and a.tenant_id = c.tenant_id
    left join contact_labels l on l.id = a.label_id and l.tenant_id = c.tenant_id`;

function toContact(row: ContactRow): ContactWithLabels {
  return {
    contact: {
      id: row.id,
      tenantId: row.tenant_id,
      channel: row.channel,
      externalKey: row.external_key,
      name: row.name,
      phone: row.phone,
      email: row.email,
      customFields: row.custom_fields,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    },
    labels: (row.labels ?? []).map((label) => ({ id: label.id, tenantId: row.tenant_id, name: label.name, color: label.color, createdAt: toIso(label.created_at) }))
  };
}

function toLabel(row: LabelRow): Label {
  return { id: row.id, tenantId: row.tenant_id, name: row.name, color: row.color, createdAt: toIso(row.created_at) };
}

/** Escapa comodines de LIKE en la búsqueda del usuario. */
const likeLiteral = (text: string) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

export class SqlContactRepository implements ContactRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string, query: ContactQuery): Promise<{ items: ContactWithLabels[]; hasMore: boolean }> {
    if (!isUuid(tenantId) || (query.labelId !== undefined && !isUuid(query.labelId))) return { items: [], hasMore: false };

    const params: unknown[] = [tenantId];
    const where = ["c.tenant_id = $1"];
    if (query.search) {
      params.push(likeLiteral(query.search));
      where.push(`(c.name ilike $${params.length} or c.phone ilike $${params.length} or c.email ilike $${params.length})`);
    }
    if (query.labelId) {
      params.push(query.labelId);
      where.push(`exists (select 1 from contact_label_assignments x where x.contact_id = c.id and x.label_id = $${params.length})`);
    }
    params.push(query.limit + 1, (query.page - 1) * query.limit);

    const result = await this.sql.query<ContactRow>(
      `${CONTACT_SELECT}
        where ${where.join(" and ")}
        group by c.id
        order by c.updated_at desc, c.id
        limit $${params.length - 1} offset $${params.length}`,
      params
    );
    return { items: result.rows.slice(0, query.limit).map(toContact), hasMore: result.rows.length > query.limit };
  }

  public async findById(tenantId: string, id: string): Promise<ContactWithLabels | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<ContactRow>(`${CONTACT_SELECT} where c.tenant_id = $1 and c.id = $2 group by c.id`, [tenantId, id]);
    return result.rows[0] ? toContact(result.rows[0]) : null;
  }

  public async findByIdentity(tenantId: string, channel: string, externalKey: string): Promise<ContactWithLabels | null> {
    if (!isUuid(tenantId)) return null;
    const result = await this.sql.query<ContactRow>(
      `${CONTACT_SELECT} where c.tenant_id = $1 and c.channel = $2 and c.external_key = $3 group by c.id`,
      [tenantId, channel, externalKey]
    );
    return result.rows[0] ? toContact(result.rows[0]) : null;
  }

  /** Si (canal, clave) ya existe, no duplica: devuelve el existente. */
  public async create(contact: Contact): Promise<ContactWithLabels> {
    await this.sql.query(
      `insert into contacts (id, tenant_id, channel, external_key, name, phone, email, custom_fields, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
       on conflict (tenant_id, channel, external_key) do nothing`,
      [contact.id, contact.tenantId, contact.channel, contact.externalKey, contact.name, contact.phone, contact.email,
        JSON.stringify(contact.customFields), contact.createdAt, contact.updatedAt]
    );
    return (await this.findByIdentity(contact.tenantId, contact.channel, contact.externalKey))!;
  }

  public async update(contact: Contact): Promise<void> {
    await this.sql.query(
      `update contacts set name = $3, email = $4, custom_fields = $5::jsonb, updated_at = $6
        where tenant_id = $1 and id = $2`,
      [contact.tenantId, contact.id, contact.name, contact.email, JSON.stringify(contact.customFields), contact.updatedAt]
    );
  }

  public async setLabels(tenantId: string, contactId: string, labelIds: ReadonlyArray<string>): Promise<void> {
    await this.sql.transaction(async (tx) => {
      await tx.query("delete from contact_label_assignments where tenant_id = $1 and contact_id = $2", [tenantId, contactId]);
      await this.insertAssignments(tx, tenantId, contactId, labelIds);
      await this.touch(tx, tenantId, contactId);
    });
  }

  public async changeLabels(tenantId: string, contactId: string, change: { add: ReadonlyArray<string>; remove: ReadonlyArray<string> }): Promise<void> {
    if (change.add.length === 0 && change.remove.length === 0) return;
    await this.sql.transaction(async (tx) => {
      if (change.remove.length > 0) {
        await tx.query(
          "delete from contact_label_assignments where tenant_id = $1 and contact_id = $2 and label_id = any($3::uuid[])",
          [tenantId, contactId, change.remove]
        );
      }
      await this.insertAssignments(tx, tenantId, contactId, change.add);
      await this.touch(tx, tenantId, contactId);
    });
  }

  private async insertAssignments(tx: SqlExecutor, tenantId: string, contactId: string, labelIds: ReadonlyArray<string>): Promise<void> {
    if (labelIds.length === 0) return;
    await tx.query(
      `insert into contact_label_assignments (tenant_id, contact_id, label_id)
       select $1, $2, unnest($3::uuid[])
       on conflict do nothing`,
      [tenantId, contactId, labelIds]
    );
  }

  private async touch(tx: SqlExecutor, tenantId: string, contactId: string): Promise<void> {
    await tx.query("update contacts set updated_at = now() where tenant_id = $1 and id = $2", [tenantId, contactId]);
  }
}

export class SqlLabelRepository implements LabelRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async list(tenantId: string): Promise<Array<Label & { contactCount: number }>> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<LabelRow>(
      `select l.id, l.tenant_id, l.name, l.color, l.created_at, count(a.contact_id) as contact_count
         from contact_labels l
         left join contact_label_assignments a on a.label_id = l.id
        where l.tenant_id = $1
        group by l.id
        order by lower(l.name)`,
      [tenantId]
    );
    return result.rows.map((row) => ({ ...toLabel(row), contactCount: Number(row.contact_count ?? 0) }));
  }

  public async findById(tenantId: string, id: string): Promise<Label | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<LabelRow>("select id, tenant_id, name, color, created_at from contact_labels where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rows[0] ? toLabel(result.rows[0]) : null;
  }

  public async findByNames(tenantId: string, names: ReadonlyArray<string>): Promise<Label[]> {
    if (!isUuid(tenantId) || names.length === 0) return [];
    const result = await this.sql.query<LabelRow>(
      "select id, tenant_id, name, color, created_at from contact_labels where tenant_id = $1 and lower(name) = any($2::text[])",
      [tenantId, names.map((name) => name.toLowerCase())]
    );
    return result.rows.map(toLabel);
  }

  public async create(label: Label): Promise<void> {
    try {
      await this.sql.query(
        "insert into contact_labels (id, tenant_id, name, color, created_at) values ($1, $2, $3, $4, $5)",
        [label.id, label.tenantId, label.name, label.color, label.createdAt]
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(`Ya existe una etiqueta llamada «${label.name}».`);
      throw error;
    }
  }

  public async update(label: Label): Promise<void> {
    try {
      await this.sql.query(
        "update contact_labels set name = $3, color = $4, updated_at = now() where tenant_id = $1 and id = $2",
        [label.tenantId, label.id, label.name, label.color]
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(`Ya existe una etiqueta llamada «${label.name}».`);
      throw error;
    }
  }

  public async delete(tenantId: string, id: string): Promise<void> {
    if (!isUuid(tenantId) || !isUuid(id)) return;
    await this.sql.query("delete from contact_labels where tenant_id = $1 and id = $2", [tenantId, id]);
  }
}

/** Violación de unicidad de PostgreSQL (23505). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}
