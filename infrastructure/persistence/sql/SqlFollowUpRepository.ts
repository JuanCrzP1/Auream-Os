import type { FollowUpQuery, FollowUpRepository, FollowUpView } from "../../../domains/crm/application/CrmRepositories";
import type { FollowUp } from "../../../domains/crm/domain/FollowUp";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlFollowUpRepository — `crm_follow_ups` (032). Vencidos · Hoy · Próximos
// se cortan con los límites que llegan (el día de la empresa).
// ---------------------------------------------------------------------------

interface Row {
  readonly id: string;
  readonly tenant_id: string;
  readonly contact_id: string;
  readonly title: string;
  readonly due_at: Date | string;
  readonly assignee_id: string | null;
  readonly created_by: string | null;
  readonly done_at: Date | string | null;
  readonly done_by: string | null;
  readonly contact_name: string | null;
  readonly assignee_name: string | null;
  readonly done_by_name: string | null;
}

const iso = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toISOString();

const SELECT = `select f.*, coalesce(c.name, c.phone) as contact_name,
                       coalesce(a.display_name, a.email) as assignee_name, coalesce(d.display_name, d.email) as done_by_name
                  from crm_follow_ups f
                  join contacts c on c.tenant_id = f.tenant_id and c.id = f.contact_id
                  left join user_profiles a on a.user_id = f.assignee_id
                  left join user_profiles d on d.user_id = f.done_by`;

function toView(row: Row): FollowUpView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    contactId: row.contact_id,
    title: row.title,
    dueAt: iso(row.due_at),
    assigneeId: row.assignee_id,
    createdBy: row.created_by,
    doneAt: row.done_at === null ? null : iso(row.done_at),
    doneBy: row.done_by,
    contactName: row.contact_name,
    assigneeName: row.assignee_name,
    doneByName: row.done_by_name
  };
}

const BUCKETS = {
  overdue: "f.done_at is null and f.due_at < $NOW",
  today: "f.done_at is null and f.due_at >= $NOW and f.due_at < $END",
  upcoming: "f.done_at is null and f.due_at >= $END",
  done: "f.done_at is not null"
} as const;

export class SqlFollowUpRepository implements FollowUpRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async find(tenantId: string, id: string): Promise<FollowUpView | null> {
    const result = await this.sql.query<Row>(`${SELECT} where f.tenant_id = $1 and f.id = $2`, [tenantId, id]);
    return result.rows[0] ? toView(result.rows[0]) : null;
  }

  public async list(tenantId: string, query: FollowUpQuery): Promise<ReadonlyArray<FollowUpView>> {
    const params: unknown[] = [tenantId, query.now.toISOString(), query.endOfToday.toISOString()];
    const clauses = ["f.tenant_id = $1"];
    if (query.bucket) clauses.push(BUCKETS[query.bucket].replaceAll("$NOW", "$2").replaceAll("$END", "$3"));
    if (query.assigneeId) {
      params.push(query.assigneeId);
      clauses.push(`f.assignee_id = $${params.length}`);
    }
    if (query.contactId) {
      params.push(query.contactId);
      clauses.push(`f.contact_id = $${params.length}`);
    }
    params.push(query.limit);
    const order = query.bucket === "done" ? "f.done_at desc" : query.bucket ? "f.due_at asc" : "(f.done_at is not null), f.due_at asc";
    // $2 y $3 van siempre en la consulta (PostgreSQL no admite parámetros sin usar).
    const result = await this.sql.query<Row>(
      `${SELECT} where ${clauses.join(" and ")} and $2::timestamptz is not null and $3::timestamptz is not null order by ${order}, f.id limit $${params.length}`,
      params
    );
    return result.rows.map(toView);
  }

  public async counts(tenantId: string, query: Omit<FollowUpQuery, "bucket" | "limit" | "contactId">) {
    const result = await this.sql.query<{ overdue: string; today: string; upcoming: string }>(
      `select count(*) filter (where due_at < $2) as overdue,
              count(*) filter (where due_at >= $2 and due_at < $3) as today,
              count(*) filter (where due_at >= $3) as upcoming
         from crm_follow_ups
        where tenant_id = $1 and done_at is null and ($4::uuid is null or assignee_id = $4::uuid)`,
      [tenantId, query.now.toISOString(), query.endOfToday.toISOString(), query.assigneeId]
    );
    const row = result.rows[0];
    return { overdue: Number(row?.overdue ?? 0), today: Number(row?.today ?? 0), upcoming: Number(row?.upcoming ?? 0) };
  }

  public async insert(followUp: FollowUp): Promise<void> {
    await this.sql.query(
      `insert into crm_follow_ups (id, tenant_id, contact_id, title, due_at, assignee_id, created_by) values ($1, $2, $3, $4, $5, $6, $7)`,
      [followUp.id, followUp.tenantId, followUp.contactId, followUp.title, followUp.dueAt, followUp.assigneeId, followUp.createdBy]
    );
  }

  public async update(followUp: FollowUp): Promise<void> {
    await this.sql.query(
      `update crm_follow_ups set title = $3, due_at = $4, assignee_id = $5, done_at = $6, done_by = $7, updated_at = now()
        where tenant_id = $1 and id = $2`,
      [followUp.tenantId, followUp.id, followUp.title, followUp.dueAt, followUp.assigneeId, followUp.doneAt, followUp.doneBy]
    );
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    const result = await this.sql.query(`delete from crm_follow_ups where tenant_id = $1 and id = $2 returning id`, [tenantId, id]);
    return result.rows.length > 0;
  }
}
