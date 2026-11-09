import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlConversationRepository } from "../../infrastructure/persistence/sql/SqlConversationRepository.js";
import { SqlConnectionRepository } from "../../infrastructure/persistence/sql/SqlConnectionRepository.js";
import { CreateConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { ConversationRecorder } from "../../domains/conversations/application/ConversationServices.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// La bandeja en vivo en PostgreSQL (`020_conversation_live.sql`): cada mensaje
// saliente guarda su id de WhatsApp, los avisos de entregado/leído solo
// avanzan y solo tocan lo enviado por ese número, y «lo que cambió desde…»
// trae lo nuevo o lo marcado con una marca que la pantalla devuelve tal cual.
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

describe("SqlConversationThread · en vivo", () => {
  it("guarda el id de WhatsApp, marca entregado/leído solo hacia adelante y trae lo cambiado", async () => {
    const tenant = await insertTenant("live-a");
    const connections = new CreateConnectionService(new SqlConnectionRepository(sql));
    const connection = await connections.execute(tenant, { name: "Ventas", method: "qr" });
    const other = await connections.execute(tenant, { name: "Soporte", method: "qr" });
    const repository = new SqlConversationRepository(sql);
    const recorder = new ConversationRecorder(repository);
    const chat = await recorder.recordInbound(tenant, {
      connectionId: connection.id, providerMessageId: "IN1", phone: "573001112233", senderName: null, kind: "text", text: "Hola",
      replyId: null, media: null, fromAd: false, providerType: "Conversation", sentAt: new Date(Date.now() - 1000).toISOString()
    }, null);
    const sent = (content: string, providerMessageId: string) => ({ message: { channel: "whatsapp", conversationKey: "k", content }, ok: true, providerMessageId });
    await recorder.recordOutbound(tenant, chat.id, [sent("Uno", "WA1"), sent("Dos", "WA2")], { author: "bot" });

    const stored = await sql.query<{ text: string; provider_message_id: string | null }>(
      "select text, provider_message_id from conversation_messages where conversation_id = $1 order by created_at, id", [chat.id]
    );
    expect(stored.rows).toEqual([{ text: "Hola", provider_message_id: "IN1" }, { text: "Uno", provider_message_id: "WA1" }, { text: "Dos", provider_message_id: "WA2" }]);

    // Lo anterior queda viejo: así se ve que «desde…» trae solo lo que cambia después.
    await sql.query("update conversation_messages set updated_at = now() - interval '2 minutes' where conversation_id = $1", [chat.id]);
    const since = new Date(Date.now() - 30_000).toISOString();
    expect((await repository.changesSince(tenant, chat.id, since)).messages).toEqual([]);

    expect(await repository.markDelivery(tenant, connection.id, ["WA1"], "delivered")).toEqual({ matched: 1, advanced: 1 });
    const changes = await repository.changesSince(tenant, chat.id, since);
    expect(changes.messages.map((m) => [m.text, m.status])).toEqual([["Uno", "delivered"]]);
    // La marca es opaca (texto de PostgreSQL): avanzó más allá de «desde…».
    const advanced = await sql.query<{ later: boolean }>("select $1::timestamptz > $2::timestamptz as later", [changes.cursor, since]);
    expect(advanced.rows[0]!.later).toBe(true);

    expect(await repository.markDelivery(tenant, connection.id, ["WA1", "WA2"], "read")).toEqual({ matched: 2, advanced: 2 });
    // Un «entregado» que llega tarde no baja de leído; un recibo de lo que escribió el cliente no toca nada.
    expect(await repository.markDelivery(tenant, connection.id, ["WA2"], "delivered")).toEqual({ matched: 1, advanced: 0 });
    expect(await repository.markDelivery(tenant, connection.id, ["IN1"], "read")).toEqual({ matched: 0, advanced: 0 });
    // Otro número u otra cuenta: no encuentra nada.
    expect(await repository.markDelivery(tenant, other.id, ["WA1"], "read")).toEqual({ matched: 0, advanced: 0 });
    const outsider = await insertTenant("live-b");
    expect(await repository.markDelivery(outsider, connection.id, ["WA1"], "read")).toEqual({ matched: 0, advanced: 0 });

    const page = await repository.messages(tenant, chat.id, { limit: 10 });
    expect(page.messages.map((m) => [m.text, m.status])).toEqual([["Hola", "received"], ["Uno", "read"], ["Dos", "read"]]);

    // La marca actual sirve tal cual como «desde…» (texto con toda su precisión).
    const cursor = await repository.liveCursor(tenant, chat.id);
    const again = await repository.changesSince(tenant, chat.id, cursor);
    expect(again.messages.map((m) => m.text)).toEqual(["Uno", "Dos"]);
    expect(again.cursor).toBe(cursor);
  });
});
