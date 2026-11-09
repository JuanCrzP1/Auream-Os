import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlSessionRepository } from "../../infrastructure/persistence/sql/SqlSessionRepository.js";
import { SqlInboundMessageLog } from "../../infrastructure/persistence/sql/SqlInboundMessageLog.js";
import { SqlConversationLock } from "../../infrastructure/persistence/sql/SqlConversationLock.js";
import { SqlConnectionRepository } from "../../infrastructure/persistence/sql/SqlConnectionRepository.js";
import { CreateConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { SessionService } from "../../domains/sessions/application/SessionService.js";
import type { FlowSnapshot } from "../../contracts/FlowSnapshot.js";
import type { InboundChannelMessage } from "../../contracts/InboundMessageContracts.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Mensajería en PostgreSQL (rama `test`): la sesión de cada conversación, el
// registro de mensajes (un mensaje se reclama una sola vez) y el candado por
// conversación (dos trabajos de la misma conversación no se solapan).
// ---------------------------------------------------------------------------

let sql: SqlClient;
let lockSql: SqlClient;

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + key, key]);
  return result.rows[0]!.id;
}

beforeAll(() => {
  sql = createTestSqlClient();
  lockSql = createTestSqlClient();
});
beforeEach(async () => {
  await cleanupTestData(sql);
});
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
  await lockSql.close();
});

const snapshot = (flowId: string) => ({ flow: { id: flowId }, version: { id: "v1", entryNodeId: "start" } }) as unknown as FlowSnapshot;

describe("sesiones, registro y candado", () => {
  it("la sesión de una conversación se guarda con su contexto y se reemplaza al terminar", async () => {
    const tenant = await insertTenant("msg-a");
    const sessions = new SessionService(new SqlSessionRepository(sql));
    const envelope = { tenantId: tenant, flowKey: "f1", channel: "whatsapp", conversationKey: "c1:573001112233", userKey: "573001112233", messageId: "m1", payload: {}, receivedAt: new Date().toISOString() };
    const first = await sessions.getOrCreateActive(tenant, envelope, snapshot("f1"));
    const moved = await sessions.moveToNode({ ...first, context: { producto: "tenis" } }, "pregunta", "waiting_input");
    expect(await sessions.getOrCreateActive(tenant, envelope, snapshot("f1"))).toMatchObject({ currentNodeId: "pregunta", status: "waiting_input", context: { producto: "tenis" } });

    await sessions.updateStatus(moved, "completed");
    expect(await sessions.getOrCreateActive(tenant, envelope, snapshot("f1"))).toMatchObject({ currentNodeId: "start", status: "active", context: {} });
  });

  it("un mensaje se reclama una sola vez y queda su resultado", async () => {
    const tenant = await insertTenant("msg-b");
    const connection = await new CreateConnectionService(new SqlConnectionRepository(sql)).execute(tenant, { name: "Ventas", method: "qr" });
    const log = new SqlInboundMessageLog(sql);
    const message: InboundChannelMessage = {
      connectionId: connection.id, providerMessageId: "MSG1", phone: "573001112233", senderName: null, kind: "text", text: "hola",
      replyId: null, media: null, fromAd: false, providerType: "Conversation", sentAt: new Date().toISOString()
    };
    expect(await log.claim(tenant, message)).toBe(true);
    expect(await log.claim(tenant, message)).toBe(false);
    await log.finish(tenant, connection.id, "MSG1", "flow_started", { flowKey: "f1", sent: 2, events: ["message_node_executed:hola"] });
    const row = await sql.query("select outcome, flow_key, sent_count, text_preview, events from inbound_messages where tenant_id = $1", [tenant]);
    expect(row.rows[0]).toEqual({ outcome: "flow_started", flow_key: "f1", sent_count: 2, text_preview: "hola", events: ["message_node_executed:hola"] });
  });

  it("el candado no deja solapar dos trabajos de la misma conversación", async () => {
    const lock = new SqlConversationLock(lockSql);
    const order: string[] = [];
    const work = (name: string, ms: number) => lock.withLock("t:c1", async () => {
      order.push(`${name}:inicio`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      order.push(`${name}:fin`);
    });
    await Promise.all([work("a", 300), work("b", 10)]);
    expect(order.indexOf("a:fin") < order.indexOf("b:inicio") || order.indexOf("b:fin") < order.indexOf("a:inicio")).toBe(true);
  });
});
