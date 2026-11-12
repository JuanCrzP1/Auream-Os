import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlConversationRepository } from "../../infrastructure/persistence/sql/SqlConversationRepository.js";
import { SqlConnectionRepository } from "../../infrastructure/persistence/sql/SqlConnectionRepository.js";
import { SqlSessionRepository } from "../../infrastructure/persistence/sql/SqlSessionRepository.js";
import { CreateConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { ConversationRecorder } from "../../domains/conversations/application/ConversationServices.js";
import { ChatAdOriginService } from "../../domains/conversations/application/ChatAdOriginService.js";
import { SqlChatAdOrigin } from "../../infrastructure/persistence/sql/SqlChatAdOrigin.js";
import { SqlAdsRepository } from "../../infrastructure/persistence/sql/SqlAdsRepository.js";
import type { InboundChannelMessage } from "../../contracts/InboundMessageContracts.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// La bandeja en PostgreSQL (rama `test`): un chat por cliente y número, el
// hilo en orden con paginación, no leídos, último mensaje, búsqueda, filtros
// y el flujo en curso del cliente.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + key, key]);
  return result.rows[0]!.id;
}

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(async () => {
  await cleanupTestData(sql);
});
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("SqlConversationRepository", () => {
  it("hilo, no leídos, último mensaje, filtros, búsqueda y flujo en curso", async () => {
    const tenant = await insertTenant("conv-a");
    const connection = await new CreateConnectionService(new SqlConnectionRepository(sql)).execute(tenant, { name: "Ventas CO", method: "qr" });
    const repository = new SqlConversationRepository(sql);
    const recorder = new ConversationRecorder(repository);
    const inbound = (id: string, text: string): InboundChannelMessage => ({
      connectionId: connection.id, providerMessageId: id, phone: "573001112233", senderName: "Laura", kind: "text", text,
      replyId: null, media: null, fromAd: false, providerType: "Conversation", sentAt: new Date(Date.now() - 1000).toISOString()
    });

    const chat = await recorder.recordInbound(tenant, inbound("m1", "Hola"), null);
    expect((await recorder.recordInbound(tenant, inbound("m2", "¿precio?"), null)).id).toBe(chat.id);
    await recorder.recordOutbound(tenant, chat.id, [
      { message: { channel: "whatsapp", conversationKey: "k", content: "Cuesta $49.900" }, ok: true },
      { message: { channel: "whatsapp", conversationKey: "k", content: "", kind: "media", media: { type: "image", url: "https://blob/x.jpg" } }, ok: false, error: "503" }
    ], { author: "bot" });

    // Flujo en curso: sesión viva de esa conversación con un flujo de la cuenta.
    const flowId = randomUUID();
    await sql.query("insert into automations (id, tenant_id, key, name, status) values ($1, $2, $3, 'Ventas', 'active')", [flowId, tenant, flowId]);
    await new SqlSessionRepository(sql).save({
      id: `${tenant}:${connection.id}:573001112233`, tenantId: tenant, flowId, flowVersionId: "v", channel: "whatsapp",
      conversationKey: `${connection.id}:573001112233`, userKey: "573001112233", currentNodeId: "pregunta", status: "waiting_input",
      revision: 1, context: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });

    const [summary] = await repository.inbox(tenant, { filter: "all", limit: 10 });
    expect(summary).toMatchObject({ connectionName: "Ventas CO", unreadCount: 2, lastMessageText: "📷 Foto", lastMessageAuthor: "bot", activeFlowName: "Ventas", botEnabled: true });

    const page = await repository.messages(tenant, chat.id, { limit: 3 });
    expect(page.hasMore).toBe(true);
    expect(page.messages.map((m) => [m.author, m.text, m.status])).toEqual([["contact", "¿precio?", "received"], ["bot", "Cuesta $49.900", "sent"], ["bot", "", "failed"]]);
    const older = await repository.messages(tenant, chat.id, { limit: 3, before: page.messages[0]!.id });
    expect(older).toMatchObject({ hasMore: false, messages: [{ text: "Hola" }] });

    await repository.markRead(tenant, chat.id);
    await repository.setBotEnabled(tenant, chat.id, false);
    expect(await repository.inbox(tenant, { filter: "unread", limit: 10 })).toEqual([]);
    expect(await repository.inbox(tenant, { filter: "bot_paused", limit: 10 })).toHaveLength(1);
    expect(await repository.inbox(tenant, { filter: "all", search: "300111", limit: 10 })).toHaveLength(1);
    expect(await repository.inbox(tenant, { filter: "all", search: "laura", limit: 10 })).toHaveLength(0);
  });

  it("etiquetas del cliente, filtros por etiqueta, bot y fecha, y páginas con cursor", async () => {
    const tenant = await insertTenant("conv-b");
    const other = await insertTenant("conv-b-otra");
    const connection = await new CreateConnectionService(new SqlConnectionRepository(sql)).execute(tenant, { name: "Ventas", method: "qr" });
    const repository = new SqlConversationRepository(sql);
    const recorder = new ConversationRecorder(repository);

    const contact = (await sql.query<{ id: string }>(
      "insert into contacts (tenant_id, channel, external_key, name, phone) values ($1, 'whatsapp', '573001112233', 'Laura', '573001112233') returning id",
      [tenant]
    )).rows[0]!.id;
    const label = async (owner: string, name: string, color: string) =>
      (await sql.query<{ id: string }>("insert into contact_labels (tenant_id, name, color) values ($1, $2, $3) returning id", [owner, name, color])).rows[0]!.id;
    const vip = await label(tenant, "VIP", "#f59e0b");
    const pago = await label(tenant, "Pagó", "#16a34a");
    const foreign = await label(other, "VIP", "#000000");
    await sql.query("insert into contact_label_assignments (tenant_id, contact_id, label_id) values ($1, $2, $3), ($1, $2, $4)", [tenant, contact, vip, pago]);

    const inbound = (id: string, phone: string, sentAt: string): InboundChannelMessage => ({
      connectionId: connection.id, providerMessageId: id, phone, senderName: null, kind: "text", text: id,
      replyId: null, media: null, fromAd: false, providerType: "Conversation", sentAt
    });
    const laura = await recorder.recordInbound(tenant, inbound("hoy", "573001112233", "2026-11-09T15:00:00.000Z"), contact);
    await recorder.recordInbound(tenant, inbound("antes", "573005550000", "2026-11-02T15:00:00.000Z"), null);
    await repository.setBotEnabled(tenant, laura.id, false);

    const phones = async (query: Partial<Parameters<typeof repository.inbox>[1]>) =>
      (await repository.inbox(tenant, { filter: "all", limit: 10, ...query })).map((c) => c.phone);

    const [first] = await repository.inbox(tenant, { filter: "all", limit: 10 });
    expect(first!.labels).toEqual([{ id: pago, name: "Pagó", color: "#16a34a" }, { id: vip, name: "VIP", color: "#f59e0b" }]);
    expect(await phones({ labelIds: [vip] })).toEqual(["573001112233"]);
    expect(await phones({ labelIds: [foreign] })).toEqual([]);
    expect(await phones({ labelIds: ["no-es-uuid"] })).toEqual([]);
    expect(await phones({ filter: "bot_active" })).toEqual(["573005550000"]);
    expect(await phones({ filter: "bot_paused" })).toEqual(["573001112233"]);
    expect(await phones({ from: "2026-11-09T00:00:00.000Z" })).toEqual(["573001112233"]);
    expect(await phones({ from: "2026-11-01T00:00:00.000Z", to: "2026-11-03T00:00:00.000Z" })).toEqual(["573005550000"]);

    const page = await repository.inbox(tenant, { filter: "all", limit: 1 });
    const next = await repository.inbox(tenant, { filter: "all", limit: 1, after: { activityAt: page[0]!.lastMessageAt!, id: page[0]!.id } });
    expect([page[0]!.phone, next[0]!.phone]).toEqual(["573001112233", "573005550000"]);
    expect(await repository.inbox(tenant, { filter: "all", limit: 1, after: { activityAt: next[0]!.lastMessageAt!, id: next[0]!.id } })).toEqual([]);
  });

  it("eliminar el número conserva sus chats (solo lectura), borra sus disparadores y libera el nombre", async () => {
    const tenant = await insertTenant("conv-c");
    const connections = new SqlConnectionRepository(sql);
    const create = new CreateConnectionService(connections);
    const connection = await create.execute(tenant, { name: "Ventas", method: "qr" });
    const repository = new SqlConversationRepository(sql);
    const chat = await new ConversationRecorder(repository).recordInbound(tenant, {
      connectionId: connection.id, providerMessageId: "x1", phone: "573001112233", senderName: null, kind: "text", text: "Hola",
      replyId: null, media: null, fromAd: false, providerType: "Conversation", sentAt: new Date().toISOString()
    }, null);
    const flowId = randomUUID();
    await sql.query("insert into automations (id, tenant_id, key, name, status) values ($1, $2, $3, 'Ventas', 'active')", [flowId, tenant, flowId]);
    await sql.query(
      "insert into connection_triggers (id, tenant_id, connection_id, automation_id, type) values ($1, $2, $3, $4, 'any_message')",
      [randomUUID(), tenant, connection.id, flowId]
    );

    expect(await connections.delete(tenant, connection.id)).toBe(true);
    expect(await connections.delete(tenant, connection.id)).toBe(false);
    expect(await connections.findById(tenant, connection.id)).toBeNull();
    expect(await connections.findForProvider(connection.id)).toBeNull();
    expect(await connections.listByTenant(tenant)).toEqual([]);
    const stored = await sql.query<{ status: string; provider_secret: string | null }>("select status, provider_secret from whatsapp_connections where id = $1", [connection.id]);
    expect(stored.rows[0]).toEqual({ status: "disconnected", provider_secret: null });
    expect((await sql.query("select 1 from connection_triggers where connection_id = $1", [connection.id])).rowCount).toBe(0);

    expect(await repository.findById(tenant, chat.id)).toMatchObject({ connectionDeleted: true });
    expect(await repository.inbox(tenant, { filter: "all", limit: 10 })).toMatchObject([{ id: chat.id, connectionName: "Ventas", connectionDeleted: true }]);
    expect((await repository.messages(tenant, chat.id, { limit: 10 })).messages.map((m) => m.text)).toEqual(["Hola"]);

    // El nombre queda libre para un número nuevo.
    expect((await create.execute(tenant, { name: "Ventas", method: "qr" })).name).toBe("Ventas");
  });

  it("anuncio de origen: la marca y el filtro «por anuncio», y su nombre y campaña si es de una cuenta conectada (nunca de otra cuenta)", async () => {
    const tenant = await insertTenant("conv-ad");
    const other = await insertTenant("conv-ad-otra");
    const one = async (text: string, params: unknown[]) => (await sql.query<{ id: string }>(text, params)).rows[0]!.id;
    const connection = await new CreateConnectionService(new SqlConnectionRepository(sql)).execute(tenant, { name: "Ventas", method: "qr" });
    const ad = { sourceId: "ad-9", sourceUrl: "https://fb.me/x", mediaUrl: null, thumbnailUrl: "https://cdn.example/t.jpg", ctwaClid: "clic", title: "Tu canción", receivedAt: "2026-11-09T19:35:00.000Z" };
    const contact = await one("insert into contacts (tenant_id, channel, external_key, name, phone, ad_origin) values ($1, 'whatsapp', '573001112233', 'Laura', '573001112233', $2::jsonb) returning id", [tenant, JSON.stringify(ad)]);
    const organic = await one("insert into contacts (tenant_id, channel, external_key, name, phone) values ($1, 'whatsapp', '573004445566', 'Pedro', '573004445566') returning id", [tenant]);
    const chat = await one("insert into conversations (id, tenant_id, connection_id, contact_id, phone, last_message_at) values ($1, $2, $3, $4, '573001112233', now()) returning id", [randomUUID(), tenant, connection.id, contact]);
    await one("insert into conversations (id, tenant_id, connection_id, contact_id, phone, last_message_at) values ($1, $2, $3, $4, '573004445566', now()) returning id", [randomUUID(), tenant, connection.id, organic]);

    const repository = new SqlConversationRepository(sql);
    const all = await repository.inbox(tenant, { filter: "all", limit: 10 });
    expect(all.map((row) => [row.contactName, row.fromAd]).sort()).toEqual([["Laura", true], ["Pedro", false]]);
    expect((await repository.inbox(tenant, { filter: "from_ad", limit: 10 })).map((row) => row.contactName)).toEqual(["Laura"]);

    const service = new ChatAdOriginService(new SqlChatAdOrigin(sql));
    // Aún sin cuenta de Meta: lo del mensaje, marcado como no conectado y sin el código de clic.
    expect((await service.get(tenant, chat)).ad).toMatchObject({ sourceId: "ad-9", title: "Tu canción", connected: false, adName: null, receivedAt: "2026-11-09T19:35:00.000Z" });

    const ads = new SqlAdsRepository(sql);
    await ads.upsertAccounts(tenant, [{ externalId: "act_1", name: "Cuenta", currency: "COP", timezone: "America/Bogota", providerStatus: 1 }]);
    const [account] = await ads.accounts(tenant);
    await ads.saveEntities(tenant, account!.id, [
      { level: "campaign", externalId: "camp-1", parentId: null, campaignId: "camp-1", name: "Video Colombia", status: "ACTIVE", dailyBudget: null, thumbnailUrl: null },
      { level: "ad", externalId: "ad-9", parentId: "set-1", campaignId: "camp-1", name: "Tu canción · Mamás", status: "PAUSED", dailyBudget: null, thumbnailUrl: "https://meta.example/oficial.jpg" }
    ]);
    const known = (await service.get(tenant, chat)).ad;
    expect(known).toMatchObject({ connected: true, adName: "Tu canción · Mamás", campaignName: "Video Colombia", adStatus: "PAUSED", thumbnailUrl: "https://meta.example/oficial.jpg" });
    expect(JSON.stringify(known)).not.toContain("clic");
    await expect(service.get(other, chat)).rejects.toThrow("Ese chat no existe.");
  });
});
