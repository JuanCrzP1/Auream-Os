import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlConversationRepository } from "../../infrastructure/persistence/sql/SqlConversationRepository.js";
import { SqlConnectionRepository } from "../../infrastructure/persistence/sql/SqlConnectionRepository.js";
import { SqlSessionRepository } from "../../infrastructure/persistence/sql/SqlSessionRepository.js";
import { CreateConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { ConversationRecorder } from "../../domains/conversations/application/ConversationServices.js";
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
});
