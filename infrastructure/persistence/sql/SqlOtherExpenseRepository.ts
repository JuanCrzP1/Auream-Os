import type { ExpenseFrequency, ExpenseKind } from "../../../contracts/OtherExpenseContracts";
import type { OtherExpenseRepository } from "../../../domains/expenses/application/OtherExpenseRepository";
import type { OtherExpense, OtherExpenseDraft } from "../../../domains/expenses/domain/OtherExpense";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Otros gastos en PostgreSQL (`045_other_expenses.sql`). Todo filtra por
// cuenta. Si se borra su línea de venta, el gasto queda para todo el negocio.
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  tenant_id: string;
  name: string;
  kind: ExpenseKind;
  amount: string;
  currency: string | null;
  frequency: ExpenseFrequency | null;
  starts_on: string;
  ends_on: string | null;
  line_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = `id, tenant_id, name, kind, amount, currency, frequency, to_char(starts_on, 'YYYY-MM-DD') as starts_on,
  to_char(ends_on, 'YYYY-MM-DD') as ends_on, line_id, created_at, updated_at`;

const toExpense = (row: Row): OtherExpense => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  kind: row.kind,
  amount: Number(row.amount),
  currency: row.currency?.trim() ?? null,
  frequency: row.frequency,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  lineId: row.line_id,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const values = (draft: OtherExpenseDraft) => [draft.name, draft.kind, draft.amount, draft.currency, draft.frequency, draft.startsOn, draft.endsOn, draft.lineId];

export class SqlOtherExpenseRepository implements OtherExpenseRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async list(tenantId: string): Promise<OtherExpense[]> {
    if (!isUuid(tenantId)) return [];
    const { rows } = await this.sql.query<Row>(`select ${COLUMNS} from other_expenses where tenant_id = $1 order by starts_on, lower(name)`, [tenantId]);
    return rows.map(toExpense);
  }

  public async find(tenantId: string, id: string): Promise<OtherExpense | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const { rows } = await this.sql.query<Row>(`select ${COLUMNS} from other_expenses where tenant_id = $1 and id = $2`, [tenantId, id]);
    return rows[0] ? toExpense(rows[0]) : null;
  }

  public async count(tenantId: string): Promise<number> {
    const { rows } = await this.sql.query<{ n: string }>("select count(*) as n from other_expenses where tenant_id = $1", [tenantId]);
    return Number(rows[0]?.n ?? 0);
  }

  public async lineExists(tenantId: string, lineId: string): Promise<boolean> {
    if (!isUuid(lineId)) return false;
    const { rows } = await this.sql.query("select 1 from sales_lines where tenant_id = $1 and id = $2", [tenantId, lineId]);
    return rows.length > 0;
  }

  public async create(tenantId: string, id: string, draft: OtherExpenseDraft): Promise<OtherExpense> {
    const { rows } = await this.sql.query<Row>(
      `insert into other_expenses (id, tenant_id, name, kind, amount, currency, frequency, starts_on, ends_on, line_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10) returning ${COLUMNS}`,
      [id, tenantId, ...values(draft)]
    );
    return toExpense(rows[0]!);
  }

  public async update(tenantId: string, id: string, draft: OtherExpenseDraft): Promise<OtherExpense | null> {
    const { rows } = await this.sql.query<Row>(
      `update other_expenses set name = $3, kind = $4, amount = $5, currency = $6, frequency = $7, starts_on = $8::date, ends_on = $9::date, line_id = $10, updated_at = now()
        where tenant_id = $1 and id = $2 returning ${COLUMNS}`,
      [tenantId, id, ...values(draft)]
    );
    return rows[0] ? toExpense(rows[0]) : null;
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(tenantId) || !isUuid(id)) return false;
    return (await this.sql.query("delete from other_expenses where tenant_id = $1 and id = $2", [tenantId, id])).rowCount > 0;
  }
}
