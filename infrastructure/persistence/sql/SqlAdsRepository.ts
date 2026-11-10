import type { AdsRepository } from "../../../domains/ads/application/AdsPorts";
import type { AdAccount, AdDailyInsight, AdEntity, MetaConnection, ProviderAdAccount } from "../../../domains/ads/domain/AdAccount";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlAdsRepository — `meta_connections`, `ad_accounts`, `ad_entities` y
// `ad_insights_daily` (033). Guardar el catálogo y las métricas va por lotes
// (`unnest`) dentro de una transacción: una cuenta con miles de anuncios no
// hace miles de idas a la base.
// ---------------------------------------------------------------------------

const iso = (value: Date | string | null) => (value === null ? null : (value instanceof Date ? value : new Date(value)).toISOString());

interface AccountRow {
  id: string; tenant_id: string; external_id: string; name: string; currency: string; timezone: string;
  provider_status: number | null; enabled: boolean; last_synced_at: Date | string | null; last_error: string | null;
}

const toAccount = (row: AccountRow): AdAccount => ({
  id: row.id,
  tenantId: row.tenant_id,
  externalId: row.external_id,
  name: row.name,
  currency: row.currency.trim(),
  timezone: row.timezone,
  providerStatus: row.provider_status,
  enabled: row.enabled,
  lastSyncedAt: iso(row.last_synced_at),
  lastError: row.last_error
});

export class SqlAdsRepository implements AdsRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async connection(tenantId: string): Promise<MetaConnection | null> {
    const { rows } = await this.sql.query<{ method: "oauth" | "token"; token_ciphertext: string; meta_user_id: string | null; meta_user_name: string | null; connected_by: string | null; expires_at: Date | string | null; last_error: string | null }>(
      `select * from meta_connections where tenant_id = $1`, [tenantId]);
    const row = rows[0];
    return row ? { tenantId, method: row.method, tokenCiphertext: row.token_ciphertext, metaUserId: row.meta_user_id, metaUserName: row.meta_user_name, connectedBy: row.connected_by, expiresAt: iso(row.expires_at), lastError: row.last_error } : null;
  }

  public async saveConnection(c: MetaConnection): Promise<void> {
    await this.sql.query(
      `insert into meta_connections (tenant_id, method, token_ciphertext, meta_user_id, meta_user_name, connected_by, expires_at, last_error)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (tenant_id) do update set method = excluded.method, token_ciphertext = excluded.token_ciphertext, meta_user_id = excluded.meta_user_id,
         meta_user_name = excluded.meta_user_name, connected_by = excluded.connected_by, expires_at = excluded.expires_at, last_error = excluded.last_error, updated_at = now()`,
      [c.tenantId, c.method, c.tokenCiphertext, c.metaUserId, c.metaUserName, c.connectedBy, c.expiresAt, c.lastError]
    );
  }

  public async setConnectionError(tenantId: string, error: string | null): Promise<void> {
    await this.sql.query(`update meta_connections set last_error = $2, updated_at = now() where tenant_id = $1`, [tenantId, error]);
  }

  public async removeConnection(tenantId: string): Promise<void> {
    await this.sql.transaction(async (tx) => {
      await tx.query(`delete from ad_accounts where tenant_id = $1`, [tenantId]);
      await tx.query(`delete from meta_connections where tenant_id = $1`, [tenantId]);
    });
  }

  public async accounts(tenantId: string): Promise<ReadonlyArray<AdAccount>> {
    const { rows } = await this.sql.query<AccountRow>(`select * from ad_accounts where tenant_id = $1 order by enabled desc, name`, [tenantId]);
    return rows.map(toAccount);
  }

  public async account(tenantId: string, accountId: string): Promise<AdAccount | null> {
    const { rows } = await this.sql.query<AccountRow>(`select * from ad_accounts where tenant_id = $1 and id = $2`, [tenantId, accountId]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  public async upsertAccounts(tenantId: string, accounts: ReadonlyArray<ProviderAdAccount>): Promise<void> {
    if (accounts.length === 0) return;
    await this.sql.query(
      `insert into ad_accounts (tenant_id, external_id, name, currency, timezone, provider_status)
       select $1, a.external_id, a.name, a.currency, a.timezone, a.status
         from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[]) as a(external_id, name, currency, timezone, status)
       on conflict (tenant_id, provider, external_id) do update set name = excluded.name, currency = excluded.currency,
         timezone = excluded.timezone, provider_status = excluded.provider_status, updated_at = now()`,
      [tenantId, accounts.map((a) => a.externalId), accounts.map((a) => a.name), accounts.map((a) => a.currency), accounts.map((a) => a.timezone), accounts.map((a) => a.providerStatus)]
    );
  }

  public async setEnabled(tenantId: string, accountId: string, enabled: boolean): Promise<AdAccount | null> {
    const { rows } = await this.sql.query<AccountRow>(`update ad_accounts set enabled = $3, updated_at = now() where tenant_id = $1 and id = $2 returning *`, [tenantId, accountId, enabled]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  public async markSynced(tenantId: string, accountId: string, error: string | null): Promise<void> {
    await this.sql.query(
      error === null
        ? `update ad_accounts set last_synced_at = now(), last_error = null, updated_at = now() where tenant_id = $1 and id = $2`
        : `update ad_accounts set last_error = $3, updated_at = now() where tenant_id = $1 and id = $2`,
      error === null ? [tenantId, accountId] : [tenantId, accountId, error.slice(0, 300)]
    );
  }

  public async saveEntities(tenantId: string, accountId: string, entities: ReadonlyArray<AdEntity>): Promise<void> {
    if (entities.length === 0) return;
    const col = <K extends keyof AdEntity>(key: K) => entities.map((entity) => entity[key]);
    await this.sql.query(
      `insert into ad_entities (tenant_id, account_id, level, external_id, parent_id, campaign_id, name, status, daily_budget, thumbnail_url)
       select $1, $2, e.level, e.external_id, e.parent_id, e.campaign_id, e.name, e.status, e.budget, e.thumb
         from unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::numeric[], $10::text[])
           as e(level, external_id, parent_id, campaign_id, name, status, budget, thumb)
       on conflict (account_id, external_id) do update set level = excluded.level, parent_id = excluded.parent_id, campaign_id = excluded.campaign_id,
         name = excluded.name, status = excluded.status, daily_budget = excluded.daily_budget, thumbnail_url = excluded.thumbnail_url, updated_at = now()`,
      [tenantId, accountId, col("level"), col("externalId"), col("parentId"), col("campaignId"), col("name"), col("status"), col("dailyBudget"), col("thumbnailUrl")]
    );
  }

  public async saveInsights(tenantId: string, accountId: string, since: string, until: string, insights: ReadonlyArray<AdDailyInsight>): Promise<void> {
    const col = <K extends keyof AdDailyInsight>(key: K) => insights.map((row) => row[key]);
    await this.sql.transaction(async (tx) => {
      await tx.query(`delete from ad_insights_daily where tenant_id = $1 and account_id = $2 and day between $3 and $4`, [tenantId, accountId, since, until]);
      if (insights.length === 0) return;
      await tx.query(
        `insert into ad_insights_daily (tenant_id, account_id, ad_id, day, spend, impressions, clicks, conversations, meta_purchases, meta_revenue)
         select $1, $2, i.ad_id, i.day, i.spend, i.impressions, i.clicks, i.conversations, i.purchases, i.revenue
           from unnest($3::text[], $4::date[], $5::numeric[], $6::bigint[], $7::bigint[], $8::int[], $9::int[], $10::numeric[])
             as i(ad_id, day, spend, impressions, clicks, conversations, purchases, revenue)
         on conflict (account_id, ad_id, day) do update set spend = excluded.spend, impressions = excluded.impressions, clicks = excluded.clicks,
           conversations = excluded.conversations, meta_purchases = excluded.meta_purchases, meta_revenue = excluded.meta_revenue`,
        [tenantId, accountId, col("adId"), col("day"), col("spend"), col("impressions"), col("clicks"), col("conversations"), col("metaPurchases"), col("metaRevenue")]
      );
    });
  }
}
