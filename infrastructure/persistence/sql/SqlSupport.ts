import type { SupportCase, SupportCaseStatus, SupportSettings } from "../../../contracts/HelpContracts";
import type { FeedbackRepository, SupportRepository } from "../../../domains/help/application/HelpPorts";
import type { SqlClient } from "./SqlClient";

// SqlSupport — `support_cases`, `platform_settings` (cómo contactar a
// soporte) y `help_feedback` (036). Cada cuenta ve solo sus casos; el equipo
// de Auream los ve todos, con la cuenta y el correo de quien escribió.

interface CaseRow {
  readonly id: string; readonly topic: SupportCase["topic"]; readonly message: string; readonly page: string; readonly screenshot_url: string | null;
  readonly article_slug: string | null; readonly status: SupportCaseStatus; readonly reply: string | null; readonly created_at: Date; readonly answered_at: Date | null;
  readonly tenant_id?: string; readonly tenant_name?: string; readonly email?: string | null;
}

const EMPTY_SETTINGS: SupportSettings = { whatsapp: null, email: null, hours: null, responseTime: null };
const toCase = (row: CaseRow, withAccount: boolean): SupportCase => ({
  id: row.id, topic: row.topic, message: row.message, page: row.page, screenshotUrl: row.screenshot_url, articleSlug: row.article_slug, status: row.status,
  reply: row.reply, createdAt: new Date(row.created_at).toISOString(), answeredAt: row.answered_at ? new Date(row.answered_at).toISOString() : null,
  ...(withAccount ? { account: { tenantId: row.tenant_id ?? "", tenantName: row.tenant_name ?? "", userEmail: row.email ?? null } } : {})
});

export class SqlSupport implements SupportRepository, FeedbackRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async settings(): Promise<SupportSettings> {
    const result = await this.sql.query<{ value: SupportSettings }>("select value from platform_settings where key = 'support'");
    return { ...EMPTY_SETTINGS, ...(result.rows[0]?.value ?? {}) };
  }

  public async saveSettings(settings: SupportSettings): Promise<void> {
    await this.sql.query("insert into platform_settings (key, value) values ('support', $1::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()", [JSON.stringify(settings)]);
  }

  public async createCase(tenantId: string, userId: string, id: string, input: Parameters<SupportRepository["createCase"]>[3]): Promise<void> {
    await this.sql.query(
      "insert into support_cases (id, tenant_id, user_id, topic, message, page, screenshot_url, article_slug) values ($1, $2, $3, $4, $5, $6, $7, $8)",
      [id, tenantId, userId, input.topic, input.message, input.page, input.screenshotUrl, input.articleSlug]
    );
  }

  public async casesOf(tenantId: string, userId: string): Promise<ReadonlyArray<SupportCase>> {
    const result = await this.sql.query<CaseRow>("select * from support_cases where tenant_id = $1 and user_id = $2 order by created_at desc limit 20", [tenantId, userId]);
    return result.rows.map((row) => toCase(row, false));
  }

  public async allCases(status: SupportCaseStatus | null, limit: number): Promise<ReadonlyArray<SupportCase>> {
    const result = await this.sql.query<CaseRow>(
      `select c.*, t.name as tenant_name, p.email from support_cases c join tenants t on t.id = c.tenant_id left join user_profiles p on p.user_id = c.user_id
        where ($1::text is null or c.status = $1) order by (c.status = 'open') desc, c.created_at desc limit $2`,
      [status, limit]
    );
    return result.rows.map((row) => toCase(row, true));
  }

  public async reply(id: string, reply: string, status: SupportCaseStatus, at: Date): Promise<boolean> {
    const result = await this.sql.query("update support_cases set reply = coalesce(nullif($2, ''), reply), status = $3, answered_at = $4 where id = $1", [id, reply, status, at]);
    return (result.rowCount ?? 0) > 0;
  }

  public async rate(tenantId: string, userId: string, slug: string, helpful: boolean, comment: string | null): Promise<void> {
    await this.sql.query("insert into help_feedback (tenant_id, user_id, slug, helpful, comment) values ($1, $2, $3, $4, $5)", [tenantId, userId, slug, helpful, comment]);
  }
}
