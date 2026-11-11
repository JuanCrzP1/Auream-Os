import type { CampaignRepository } from "../../../domains/groups/application/GroupPorts";
import type { Campaign } from "../../../domains/groups/domain/Campaign";
import type { SqlClient } from "./SqlClient";

// SqlGroupCampaigns — `group_campaigns` (035). El `slug` es único en toda la
// plataforma: el enlace es público y no lleva la cuenta.

interface Row {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: Campaign["status"];
  readonly connection_ids: string[];
  readonly capacity: number;
  readonly template: Campaign["template"];
  readonly rules: Campaign["rules"];
  readonly created_at: Date;
}

const toCampaign = (row: Row): Campaign => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  slug: row.slug,
  status: row.status,
  connectionIds: row.connection_ids,
  capacity: row.capacity,
  template: row.template,
  rules: row.rules,
  createdAt: new Date(row.created_at).toISOString()
});

export class SqlGroupCampaigns implements CampaignRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async create(campaign: Campaign): Promise<void> {
    await this.sql.query(
      `insert into group_campaigns (id, tenant_id, name, slug, status, connection_ids, capacity, template, rules, created_at)
       values ($1, $2, $3, $4, $5, $6::uuid[], $7, $8::jsonb, $9::jsonb, $10)`,
      [campaign.id, campaign.tenantId, campaign.name, campaign.slug, campaign.status, campaign.connectionIds, campaign.capacity, JSON.stringify(campaign.template), JSON.stringify(campaign.rules), campaign.createdAt]
    );
  }

  public async update(tenantId: string, campaign: Campaign): Promise<void> {
    await this.sql.query(
      `update group_campaigns set name = $3, slug = $4, status = $5, connection_ids = $6::uuid[], capacity = $7, template = $8::jsonb, rules = $9::jsonb, updated_at = now()
        where tenant_id = $1 and id = $2`,
      [tenantId, campaign.id, campaign.name, campaign.slug, campaign.status, campaign.connectionIds, campaign.capacity, JSON.stringify(campaign.template), JSON.stringify(campaign.rules)]
    );
  }

  public async find(tenantId: string, id: string): Promise<Campaign | null> {
    const result = await this.sql.query<Row>("select * from group_campaigns where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rows[0] ? toCampaign(result.rows[0]) : null;
  }

  public async findBySlug(slug: string): Promise<Campaign | null> {
    const result = await this.sql.query<Row>("select * from group_campaigns where slug = $1", [slug]);
    return result.rows[0] ? toCampaign(result.rows[0]) : null;
  }

  public async list(tenantId: string): Promise<ReadonlyArray<Campaign>> {
    const result = await this.sql.query<Row>("select * from group_campaigns where tenant_id = $1 order by created_at desc", [tenantId]);
    return result.rows.map(toCampaign);
  }

  public async slugTaken(slug: string, exceptId: string | null): Promise<boolean> {
    const result = await this.sql.query("select 1 from group_campaigns where slug = $1 and ($2::uuid is null or id <> $2::uuid)", [slug, exceptId]);
    return result.rows.length > 0;
  }
}
