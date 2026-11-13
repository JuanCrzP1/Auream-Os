import { labelKey, type Label } from "../../../domains/contacts/domain/Label";
import type { LabelRepository } from "../../../domains/contacts/application/ContactRepository";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// El catálogo de etiquetas de una cuenta en PostgreSQL (`contact_labels`).
// Dos nombres que una persona lee igual («Pagado», «pagádo», «‎Pagado» con
// un carácter invisible) son la misma etiqueta: se buscan y se impiden así.
// ---------------------------------------------------------------------------

interface LabelRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly color: string;
  readonly created_at: Date;
  readonly contact_count?: string;
}

function toLabel(row: LabelRow): Label {
  return { id: row.id, tenantId: row.tenant_id, name: row.name, color: row.color, createdAt: toIso(row.created_at) };
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

  /** Por nombre como lo ve una persona (sin mayúsculas, tildes ni caracteres invisibles): «Pagado» encuentra «‎pagado». La más antigua primero. */
  public async findByNames(tenantId: string, names: ReadonlyArray<string>): Promise<Label[]> {
    if (!isUuid(tenantId) || names.length === 0) return [];
    const keys = new Set(names.map(labelKey));
    return (await this.all(tenantId)).filter((label) => keys.has(labelKey(label.name)));
  }

  public async create(label: Label): Promise<void> {
    await this.ensureUnique(label);
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
    await this.ensureUnique(label);
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

  /** Todas las de la cuenta (pocas), la más antigua primero. */
  private async all(tenantId: string): Promise<Label[]> {
    const result = await this.sql.query<LabelRow>("select id, tenant_id, name, color, created_at from contact_labels where tenant_id = $1 order by created_at, id", [tenantId]);
    return result.rows.map(toLabel);
  }

  /** La base distingue «Pagado» de «Pagádo» o «‎Pagado»; una persona no: tampoco se dejan crear. */
  private async ensureUnique(label: Label): Promise<void> {
    if (!isUuid(label.tenantId)) return;
    const twin = (await this.all(label.tenantId)).find((other) => other.id !== label.id && labelKey(other.name) === labelKey(label.name));
    if (twin) throw new ConflictError(`Ya existe una etiqueta llamada «${twin.name}».`);
  }
}

/** Violación de unicidad de PostgreSQL (23505). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}
