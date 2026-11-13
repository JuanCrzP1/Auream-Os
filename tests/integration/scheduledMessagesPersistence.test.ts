import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlConversationRepository } from "../../infrastructure/persistence/sql/SqlConversationRepository.js";
import { SqlConnectionRepository } from "../../infrastructure/persistence/sql/SqlConnectionRepository.js";
import { SqlScheduledMessageRepository } from "../../infrastructure/persistence/sql/SqlScheduledMessageRepository.js";
import { CreateConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { ConversationRecorder } from "../../domains/conversations/application/ConversationServices.js";
import type { InboundChannelMessage } from "../../contracts/InboundMessageContracts.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Mensajes programados en PostgreSQL (rama `test`): guardar y listar los
// abiertos, tomarlo para enviar UNA sola vez aunque dos procesos lo intenten,
// terminar y cancelar, la bandeja (próximo, «no salió» y el filtro), el último
// mensaje del cliente y que nada cruza de cuenta.
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

describe("SqlScheduledMessageRepository", () => {
  it("guarda, lista, se toma una sola vez, termina, cancela y se ve en la bandeja", async () => {
    const tenant = await insertTenant("sched-a");
    const other = await insertTenant("sched-b");
    const connection = await new CreateConnectionService(new SqlConnectionRepository(sql)).execute(tenant, { name: "Ventas CO", method: "qr" });
    const chats = new SqlConversationRepository(sql);
    const inbound: InboundChannelMessage = {
      connectionId: connection.id, providerMessageId: "m1", phone: "573001112233", senderName: "Laura", kind: "text", text: "Hola",
      replyId: null, media: null, fromAd: false, providerType: "Conversation", sentAt: new Date(Date.now() - 1000).toISOString()
    };
    const chat = await new ConversationRecorder(chats).recordInbound(tenant, inbound, null);
    const repository = new SqlScheduledMessageRepository(sql);
    const parts = [{ kind: "text" as const, text: "Te recuerdo el pago 🙏" }];
    const first = randomUUID();
    const second = randomUUID();
    const later = new Date(Date.now() + 86_400_000);
    const sooner = new Date(Date.now() + 3_600_000);

    await repository.insert({ id: first, tenantId: tenant, conversationId: chat.id, parts, sendAt: later, cancelIfReplied: true, authorId: randomUUID() });
    await repository.insert({ id: second, tenantId: tenant, conversationId: chat.id, parts, sendAt: sooner, cancelIfReplied: false, authorId: "no-es-uuid" });
    // En un chat de otra cuenta no se guarda nada.
    await repository.insert({ id: randomUUID(), tenantId: other, conversationId: chat.id, parts, sendAt: later, cancelIfReplied: true, authorId: randomUUID() });

    const open = await repository.open(tenant, chat.id);
    expect(open.map((message) => message.id)).toEqual([second, first]);
    expect(open[1]).toMatchObject({ parts, cancelIfReplied: true, status: "pending", error: null, claimedAt: null, sendAt: later.toISOString() });
    expect(open[0]!.authorId).toBeNull();
    expect(await repository.countPending(tenant, chat.id)).toBe(2);
    expect(await repository.find(other, first)).toBeNull();
    expect(await repository.open(other, chat.id)).toEqual([]);

    let [summary] = await chats.inbox(tenant, { filter: "scheduled", limit: 10 });
    expect(summary).toMatchObject({ id: chat.id, nextScheduledAt: sooner.toISOString(), scheduledIssue: false });

    // Dos procesos a la vez: solo uno lo toma.
    const now = new Date();
    const claims = await Promise.all([repository.claim(tenant, second, ["pending"], now), repository.claim(tenant, second, ["pending"], now)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await repository.update(tenant, second, { parts, sendAt: later, cancelIfReplied: true, armedAt: now })).toBe(false);
    await repository.finish(tenant, second, { status: "failed", error: "El número no tiene una sesión activa para enviar." }, now);
    expect(await repository.find(tenant, second)).toMatchObject({ status: "failed", error: "El número no tiene una sesión activa para enviar." });

    [summary] = await chats.inbox(tenant, { filter: "all", limit: 10 });
    expect(summary).toMatchObject({ nextScheduledAt: later.toISOString(), scheduledIssue: true });

    // Reintentar: se toma desde «fallido»; si no se llegó a enviar, vuelve a como estaba.
    expect(await repository.claim(tenant, second, ["failed"], now)).toMatchObject({ status: "sending", error: null });
    await repository.release(tenant, second, "failed");
    expect((await repository.find(tenant, second))!.status).toBe("failed");

    expect(await repository.update(tenant, first, { parts: [{ kind: "text", text: "Editado" }], sendAt: sooner, cancelIfReplied: false, armedAt: now })).toBe(true);
    expect(await repository.find(tenant, first)).toMatchObject({ parts: [{ kind: "text", text: "Editado" }], sendAt: sooner.toISOString(), cancelIfReplied: false, armedAt: now.toISOString() });

    expect(await repository.cancel(other, first, ["pending"], now)).toBe(false);
    expect(await repository.cancel(tenant, first, ["pending"], now)).toBe(true);
    expect(await repository.cancel(tenant, second, ["pending", "failed", "skipped"], now)).toBe(true);
    expect(await repository.open(tenant, chat.id)).toEqual([]);
    expect(await chats.inbox(tenant, { filter: "scheduled", limit: 10 })).toEqual([]);
    [summary] = await chats.inbox(tenant, { filter: "all", limit: 10 });
    expect(summary).toMatchObject({ nextScheduledAt: null, scheduledIssue: false });

    expect(await repository.lastInboundAt(tenant, chat.id)).not.toBeNull();
    expect(await repository.lastInboundAt(other, chat.id)).toBeNull();

    // Si se elimina el chat, se van sus programados.
    await repository.insert({ id: randomUUID(), tenantId: tenant, conversationId: chat.id, parts, sendAt: later, cancelIfReplied: true, authorId: randomUUID() });
    await chats.remove(tenant, chat.id);
    const left = await sql.query<{ total: string }>("select count(*) as total from scheduled_messages where tenant_id = $1", [tenant]);
    expect(Number(left.rows[0]!.total)).toBe(0);
  });
});
