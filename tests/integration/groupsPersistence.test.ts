import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlGroupCampaigns } from "../../infrastructure/persistence/sql/SqlGroupCampaigns.js";
import { SqlGroupPosts } from "../../infrastructure/persistence/sql/SqlGroupPosts.js";
import { SqlGroupResults } from "../../infrastructure/persistence/sql/SqlGroupResults.js";
import { SqlWaGroups } from "../../infrastructure/persistence/sql/SqlWaGroups.js";
import { requireCampaignDraft } from "../../domains/groups/domain/Campaign.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Grupos en PostgreSQL (rama `test`): la campaña con enlace único, los grupos
// sincronizados (y los que desaparecen), una posición « #n» por campaña, las
// entradas y salidas, el clic, la venta de quien estaba en el grupo y el
// envío grupo por grupo.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const CONNECTION = "44444444-4444-4444-8444-444444444444";
const q = async (text: string, params: unknown[] = []) => (await sql.query<{ id: string }>(text, params)).rows[0]!;
const JID = (n: number) => `12036300000000000${n}@g.us`;

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(() => cleanupTestData(sql));
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("Grupos en PostgreSQL", () => {
  it("campaña, grupos, miembros, clics, ventas y envíos", async () => {
    const tenant = (await q("insert into tenants (key, name) values ($1, 'grupos') returning id", [TEST_KEY_PREFIX + "grp"])).id;
    await q("insert into whatsapp_connections (id, tenant_id, name, method, status) values ($1, $2, 'Ventas 1', 'qr', 'connected') returning id", [CONNECTION, tenant]);
    const campaigns = new SqlGroupCampaigns(sql);
    const slug = `it-navidad-${Date.now() % 100000}`;
    const campaign = { ...requireCampaignDraft({ name: "Navidad", slug, connectionIds: [CONNECTION] }), id: "55555555-5555-4555-8555-555555555555", tenantId: tenant, status: "active" as const, createdAt: new Date().toISOString() };
    await campaigns.create(campaign);
    expect(await campaigns.slugTaken(slug, null)).toBe(true);
    expect((await campaigns.findBySlug(slug))?.id).toBe(campaign.id);

    const groups = new SqlWaGroups(sql);
    const now = new Date();
    await groups.saveSynced(tenant, CONNECTION, [
      { jid: JID(1), name: "Clientes VIP", description: "", imageUrl: null, memberCount: 2, members: [{ key: "573001110001", phone: "573001110001", isAdmin: true }, { key: "573001110002", phone: "573001110002", isAdmin: false }], isAdmin: true, announce: false, locked: false, inviteLink: null, isCommunity: false },
      { jid: JID(2), name: "Comunidad", description: "", imageUrl: null, memberCount: 9, members: null, isAdmin: true, announce: false, locked: false, inviteLink: null, isCommunity: true }
    ], now);
    expect((await groups.list(tenant)).map((g) => g.name)).toEqual(["Clientes VIP"]);

    const created = { id: "66666666-6666-4666-8666-666666666666", tenantId: tenant, connectionId: CONNECTION, jid: JID(3), name: "Navidad #1", description: "", imageUrl: null, members: 1, isAdmin: true, announce: true, locked: true, inviteLink: "https://chat.whatsapp.com/abc", campaignId: campaign.id, position: 1, syncedAt: now.toISOString(), lastWelcomeAt: now.toISOString(), createdAt: now.toISOString() };
    expect(await groups.insertCreated(created)).toBe(true);
    expect(await groups.insertCreated({ ...created, id: "77777777-7777-4777-8777-777777777777", jid: JID(4) })).toBe(false);

    const joinAt = new Date(now.getTime() + 1000);
    const joined = await groups.applyMoves(tenant, created.id, [{ key: "573001110003", phone: "573001110003", isAdmin: false }, { key: "lid:99", phone: null, isAdmin: false }], [], joinAt);
    expect(joined).toHaveLength(2);
    expect(await groups.applyMoves(tenant, created.id, [{ key: "573001110003", phone: "573001110003", isAdmin: false }], [], new Date(joinAt.getTime() + 1000))).toHaveLength(0);
    await groups.applyMoves(tenant, created.id, [], [{ key: "lid:99", phone: null, isAdmin: false }], new Date(joinAt.getTime() + 2000));
    expect((await groups.find(tenant, created.id))?.members).toBe(1);
    expect(await groups.joinedSince(tenant, created.id, now)).toEqual(["573001110003"]);
    await groups.recordClick(tenant, campaign.id, created.id, "ig", now);

    const product = (await q("insert into products (tenant_id, name) values ($1, 'Video') returning id", [tenant])).id;
    await q("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, customer_phone, sold_at) values ($1, 'approved', 'manual', $2, 'Video', 49900, 'COP', '573001110003', $3) returning id", [tenant, product, new Date(joinAt.getTime() + 60_000)]);
    const results = new SqlGroupResults(sql);
    expect((await results.campaigns(tenant, [campaign.id], null)).get(campaign.id)).toMatchObject({ clicks: 1, joined: 2, left: 1, buyers: 1, revenue: [{ currency: "COP", amount: 49900 }] });
    expect((await results.groups(tenant, [created.id], null)).get(created.id)).toMatchObject({ buyers: 1, joined: 2 });
    expect((await results.daily(tenant, campaign.id, 3, "America/Bogota")).length).toBe(3);

    await groups.saveSynced(tenant, CONNECTION, [], new Date());
    expect((await groups.list(tenant)).map((g) => g.name)).toEqual([]);

    const posts = new SqlGroupPosts(sql);
    const post = { id: "88888888-8888-4888-8888-888888888888", tenantId: tenant, content: { kind: "text" as const, text: "Hola", mediaUrl: null, fileName: null, choices: [] }, mentionAll: true, status: "scheduled" as const, target: "Navidad", campaignIds: [campaign.id], scheduledAt: null, finishedAt: null, createdAt: new Date().toISOString() };
    await posts.create(post, [created.id]);
    const next = await posts.claimNext(tenant, post.id);
    expect(next?.groupId).toBe(created.id);
    expect(await posts.claimNext(tenant, post.id)).toBeNull();
    await posts.finishDelivery(tenant, next!.deliveryId, { ok: true, providerMessageId: "w1", error: null }, new Date());
    expect((await posts.list(tenant, campaign.id, 10))[0]).toMatchObject({ groups: 1, sent: 1, failed: 0 });
    expect(await posts.transition(tenant, post.id, ["scheduled"], "done", new Date())).toBe(true);
  });
});
