import { randomUUID } from "node:crypto";
import type { GroupRepository, Member, ProviderGroup, WaGroup } from "../../../domains/groups/application/GroupPorts";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlWaGroups — `wa_groups`, `wa_group_members` y `group_link_clicks` (035).
// Los grupos que ya no aparecen en WhatsApp quedan marcados (`removed_at`),
// no se borran: su historia y sus ventas siguen contando.
// ---------------------------------------------------------------------------

interface Row {
  readonly id: string;
  readonly tenant_id: string;
  readonly connection_id: string;
  readonly jid: string;
  readonly name: string;
  readonly description: string;
  readonly image_url: string | null;
  readonly members: number;
  readonly is_admin: boolean;
  readonly announce: boolean;
  readonly locked: boolean;
  readonly invite_link: string | null;
  readonly campaign_id: string | null;
  readonly position: number | null;
  readonly synced_at: Date | null;
  readonly last_welcome_at: Date | null;
  readonly created_at: Date;
}

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
const toGroup = (row: Row): WaGroup => ({
  id: row.id, tenantId: row.tenant_id, connectionId: row.connection_id, jid: row.jid, name: row.name, description: row.description, imageUrl: row.image_url,
  members: row.members, isAdmin: row.is_admin, announce: row.announce, locked: row.locked, inviteLink: row.invite_link, campaignId: row.campaign_id,
  position: row.position, syncedAt: iso(row.synced_at), lastWelcomeAt: iso(row.last_welcome_at), createdAt: new Date(row.created_at).toISOString()
});

const COLUMNS: Readonly<Record<string, string>> = {
  name: "name", description: "description", imageUrl: "image_url", announce: "announce", locked: "locked", inviteLink: "invite_link",
  campaignId: "campaign_id", position: "position", lastWelcomeAt: "last_welcome_at"
};

export class SqlWaGroups implements GroupRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string, campaignId?: string): Promise<ReadonlyArray<WaGroup>> {
    const result = await this.sql.query<Row>(
      `select g.* from wa_groups g join whatsapp_connections w on w.id = g.connection_id and w.deleted_at is null
        where g.tenant_id = $1 and g.removed_at is null and ($2::uuid is null or g.campaign_id = $2::uuid) order by g.created_at`,
      [tenantId, campaignId ?? null]
    );
    return result.rows.map(toGroup);
  }

  public async find(tenantId: string, id: string): Promise<WaGroup | null> {
    const result = await this.sql.query<Row>("select * from wa_groups where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rows[0] ? toGroup(result.rows[0]) : null;
  }

  public async findByJid(tenantId: string, connectionId: string, jid: string): Promise<WaGroup | null> {
    const result = await this.sql.query<Row>("select * from wa_groups where tenant_id = $1 and connection_id = $2 and jid = $3", [tenantId, connectionId, jid]);
    return result.rows[0] ? toGroup(result.rows[0]) : null;
  }

  public async saveSynced(tenantId: string, connectionId: string, groups: ReadonlyArray<ProviderGroup>, at: Date): Promise<void> {
    const kept = groups.filter((group) => !group.isCommunity);
    for (const group of kept) {
      const saved = await this.sql.query<{ id: string }>(
        `insert into wa_groups (id, tenant_id, connection_id, jid, name, description, image_url, members, is_admin, announce, locked, invite_link, synced_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         on conflict (connection_id, jid) do update set name = excluded.name, description = excluded.description, image_url = excluded.image_url,
           members = excluded.members, is_admin = excluded.is_admin, announce = excluded.announce, locked = excluded.locked,
           invite_link = coalesce(excluded.invite_link, wa_groups.invite_link), synced_at = excluded.synced_at, removed_at = null
         returning id`,
        [randomUUID(), tenantId, connectionId, group.jid, group.name, group.description, group.imageUrl, group.memberCount, group.isAdmin, group.announce, group.locked, group.inviteLink, at]
      );
      if (group.members) await this.syncMembers(tenantId, saved.rows[0]!.id, group.members, at);
    }
    await this.sql.query(
      "update wa_groups set removed_at = $3 where tenant_id = $1 and connection_id = $2 and removed_at is null and not (jid = any($4::text[]))",
      [tenantId, connectionId, at, kept.map((group) => group.jid)]
    );
  }

  /** Los que están y no estaban entran (de la sincronización, no cuentan como entradas); los que ya no están, salen. */
  private async syncMembers(tenantId: string, groupId: string, members: ReadonlyArray<Member>, at: Date): Promise<void> {
    await this.sql.query(
      `insert into wa_group_members (tenant_id, group_id, member_key, phone, is_admin, source, joined_at)
       select $1, $2, m.key, m.phone, m.admin, 'sync', $3 from unnest($4::text[], $5::text[], $6::boolean[]) as m(key, phone, admin)
       on conflict (group_id, member_key) do update set phone = coalesce(excluded.phone, wa_group_members.phone), is_admin = excluded.is_admin,
         left_at = null, joined_at = case when wa_group_members.left_at is null then wa_group_members.joined_at else excluded.joined_at end`,
      [tenantId, groupId, at, members.map((m) => m.key), members.map((m) => m.phone), members.map((m) => m.isAdmin)]
    );
    await this.sql.query("update wa_group_members set left_at = $3 where group_id = $1 and tenant_id = $2 and left_at is null and not (member_key = any($4::text[]))", [groupId, tenantId, at, members.map((m) => m.key)]);
  }

  public async insertCreated(group: WaGroup): Promise<boolean> {
    const result = await this.sql.query(
      `insert into wa_groups (id, tenant_id, connection_id, jid, name, description, image_url, members, is_admin, announce, locked, invite_link, campaign_id, position, synced_at, last_welcome_at, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, $12, $13, $14, $15, $16) on conflict do nothing`,
      [group.id, group.tenantId, group.connectionId, group.jid, group.name, group.description, group.imageUrl, group.members, group.announce, group.locked, group.inviteLink, group.campaignId, group.position, group.syncedAt, group.lastWelcomeAt, group.createdAt]
    );
    return (result.rowCount ?? 0) > 0;
  }

  public async update(tenantId: string, id: string, patch: Parameters<GroupRepository["update"]>[2]): Promise<void> {
    const keys = Object.keys(patch).filter((key) => COLUMNS[key] && (patch as Record<string, unknown>)[key] !== undefined);
    if (keys.length === 0) return;
    await this.sql.query(`update wa_groups set ${keys.map((key, i) => `${COLUMNS[key]} = $${i + 3}`).join(", ")} where tenant_id = $1 and id = $2`, [
      tenantId,
      id,
      ...keys.map((key) => (patch as Record<string, unknown>)[key])
    ]);
  }

  public async applyMoves(tenantId: string, groupId: string, joins: ReadonlyArray<Member>, leaves: ReadonlyArray<Member>, at: Date): Promise<ReadonlyArray<Member>> {
    const joined: Member[] = [];
    for (const member of joins) {
      const result = await this.sql.query<{ fresh: boolean }>(
        `insert into wa_group_members (tenant_id, group_id, member_key, phone, is_admin, source, joined_at) values ($1, $2, $3, $4, false, 'event', $5)
         on conflict (group_id, member_key) do update set phone = coalesce(excluded.phone, wa_group_members.phone),
           source = case when wa_group_members.left_at is null then wa_group_members.source else 'event' end,
           joined_at = case when wa_group_members.left_at is null then wa_group_members.joined_at else excluded.joined_at end, left_at = null
         returning (xmax = 0 or joined_at = $5) as fresh`,
        [tenantId, groupId, member.key, member.phone, at]
      );
      if (result.rows[0]?.fresh) joined.push(member);
    }
    if (leaves.length > 0) {
      await this.sql.query("update wa_group_members set left_at = $3 where tenant_id = $1 and group_id = $2 and left_at is null and member_key = any($4::text[])", [tenantId, groupId, at, leaves.map((m) => m.key)]);
    }
    await this.sql.query(
      "update wa_groups set members = greatest(1, (select count(*) from wa_group_members m where m.group_id = $2 and m.left_at is null)) where tenant_id = $1 and id = $2",
      [tenantId, groupId]
    );
    return joined;
  }

  public async joinedSince(tenantId: string, groupId: string, since: Date): Promise<ReadonlyArray<string>> {
    const result = await this.sql.query<{ phone: string }>(
      "select phone from wa_group_members where tenant_id = $1 and group_id = $2 and source = 'event' and joined_at > $3 and left_at is null and phone is not null order by joined_at",
      [tenantId, groupId, since]
    );
    return result.rows.map((row) => row.phone);
  }

  public async recordClick(tenantId: string, campaignId: string, groupId: string | null, source: string | null, at: Date): Promise<void> {
    await this.sql.query("insert into group_link_clicks (tenant_id, campaign_id, group_id, source, created_at) values ($1, $2, $3, $4, $5)", [tenantId, campaignId, groupId, source, at]);
  }

  public async lastSyncedAt(tenantId: string): Promise<string | null> {
    const result = await this.sql.query<{ at: Date | null }>("select max(synced_at) as at from wa_groups where tenant_id = $1", [tenantId]);
    return iso(result.rows[0]?.at ?? null);
  }
}
