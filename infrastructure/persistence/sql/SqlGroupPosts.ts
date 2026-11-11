import type { GroupPostStatus } from "../../../contracts/GroupContracts";
import type { GroupPost, PostRepository } from "../../../domains/groups/application/GroupPorts";
import type { SqlClient } from "./SqlClient";

// SqlGroupPosts — `group_posts` y `group_post_deliveries` (035). Tomar el
// siguiente grupo es atómico: dos rondas nunca envían dos veces al mismo.

interface Row {
  readonly id: string;
  readonly tenant_id: string;
  readonly content: GroupPost["content"];
  readonly mention_all: boolean;
  readonly status: GroupPostStatus;
  readonly target: string;
  readonly campaign_ids: string[];
  readonly scheduled_at: Date | null;
  readonly finished_at: Date | null;
  readonly created_at: Date;
}

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
const toPost = (row: Row): GroupPost => ({
  id: row.id, tenantId: row.tenant_id, content: row.content, mentionAll: row.mention_all, status: row.status, target: row.target, campaignIds: row.campaign_ids,
  scheduledAt: iso(row.scheduled_at), finishedAt: iso(row.finished_at), createdAt: new Date(row.created_at).toISOString()
});

export class SqlGroupPosts implements PostRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async create(post: GroupPost, groupIds: ReadonlyArray<string>): Promise<void> {
    await this.sql.transaction(async (tx) => {
      await tx.query(
        `insert into group_posts (id, tenant_id, content, mention_all, status, target, campaign_ids, scheduled_at, created_at)
         values ($1, $2, $3::jsonb, $4, $5, $6, $7::uuid[], $8, $9)`,
        [post.id, post.tenantId, JSON.stringify(post.content), post.mentionAll, post.status, post.target, post.campaignIds, post.scheduledAt, post.createdAt]
      );
      await tx.query(
        `insert into group_post_deliveries (tenant_id, post_id, group_id, position)
         select $1, $2, g.id, g.n from unnest($3::uuid[]) with ordinality as g(id, n)`,
        [post.tenantId, post.id, groupIds]
      );
    });
  }

  public async find(tenantId: string, id: string): Promise<GroupPost | null> {
    const result = await this.sql.query<Row>("select * from group_posts where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rows[0] ? toPost(result.rows[0]) : null;
  }

  public async list(tenantId: string, campaignId: string | null, limit: number) {
    const result = await this.sql.query<Row & { groups: string; sent: string; failed: string }>(
      `select p.*, count(d.id) as groups, count(d.id) filter (where d.status = 'sent') as sent, count(d.id) filter (where d.status = 'failed') as failed
         from group_posts p left join group_post_deliveries d on d.post_id = p.id
        where p.tenant_id = $1 and ($2::uuid is null or $2::uuid = any(p.campaign_ids))
        group by p.id order by coalesce(p.scheduled_at, p.created_at) desc limit $3`,
      [tenantId, campaignId, limit]
    );
    return result.rows.map((row) => ({ ...toPost(row), groups: Number(row.groups), sent: Number(row.sent), failed: Number(row.failed) }));
  }

  public async transition(tenantId: string, id: string, from: ReadonlyArray<GroupPostStatus>, to: GroupPostStatus, finishedAt?: Date): Promise<boolean> {
    const result = await this.sql.query(
      "update group_posts set status = $4, finished_at = coalesce($5, finished_at) where tenant_id = $1 and id = $2 and status = any($3::text[])",
      [tenantId, id, from, to, finishedAt ?? null]
    );
    return (result.rowCount ?? 0) > 0;
  }

  public async claimNext(tenantId: string, postId: string): Promise<{ readonly deliveryId: string; readonly groupId: string } | null> {
    const result = await this.sql.query<{ id: string; group_id: string }>(
      `update group_post_deliveries set status = 'sending'
        where id = (select id from group_post_deliveries where tenant_id = $1 and post_id = $2 and status = 'pending' order by position limit 1 for update skip locked)
        returning id, group_id`,
      [tenantId, postId]
    );
    const row = result.rows[0];
    return row ? { deliveryId: row.id, groupId: row.group_id } : null;
  }

  public async finishDelivery(tenantId: string, deliveryId: string, outcome: { readonly ok: boolean; readonly providerMessageId: string | null; readonly error: string | null }, at: Date): Promise<void> {
    await this.sql.query("update group_post_deliveries set status = $3, provider_message_id = $4, error = $5, sent_at = $6 where tenant_id = $1 and id = $2", [
      tenantId,
      deliveryId,
      outcome.ok ? "sent" : "failed",
      outcome.providerMessageId,
      outcome.error,
      at
    ]);
  }

  public async cancelPending(tenantId: string, postId: string): Promise<void> {
    await this.sql.query("update group_post_deliveries set status = 'cancelled' where tenant_id = $1 and post_id = $2 and status = 'pending'", [tenantId, postId]);
  }
}
