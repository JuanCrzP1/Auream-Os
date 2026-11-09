import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlWebhookRepository } from "../../infrastructure/persistence/sql/SqlWebhookRepository.js";
import { EMPTY_WEBHOOK_MAPPING } from "../../contracts/WebhookContracts.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// Webhooks de entrada en PostgreSQL (`024_inbound_webhooks.sql`): por cuenta,
// ejemplo, historial, uso del mes y borrado en cascada.

let sql: SqlClient;

beforeAll(() => {
  sql = createTestSqlClient();
});

afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("SqlWebhookRepository", () => {
  it("guarda, edita, recibe ejemplos e historial, cuenta el mes y borra en cascada", async () => {
    const tenant = (await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [`${TEST_KEY_PREFIX}webhooks`, "webhooks"])).rows[0]!.id;
    const repo = new SqlWebhookRepository(sql);
    const id = randomUUID();
    const at = "2026-11-09T12:00:00.000Z";
    await repo.create({ id, tenantId: tenant, name: "Hotmart", enabled: true, connectionId: null, secretEnvelope: "sobre", mapping: EMPTY_WEBHOOK_MAPPING, sample: null, sampleReceivedAt: null, createdAt: at, updatedAt: at });
    await repo.update({ ...(await repo.findById(tenant, id))!, name: "Hotmart ventas", mapping: { ...EMPTY_WEBHOOK_MAPPING, phonePath: "buyer.phone" } });
    await repo.saveSample(tenant, id, { buyer: { phone: "300" } }, "2026-11-09T12:05:00.000Z");

    const found = await repo.findForDelivery(id);
    expect(found).toMatchObject({ tenantId: tenant, name: "Hotmart ventas", mapping: { phonePath: "buyer.phone" }, sample: { buyer: { phone: "300" } }, sampleReceivedAt: "2026-11-09T12:05:00.000Z" });
    expect(await repo.findById(randomUUID(), id)).toBeNull();

    const delivery = { tenantId: tenant, webhookId: id, phone: "573001234567", contactId: null, flowStarted: false, notes: ["nota"], error: null, payload: { a: 1 } };
    await repo.recordDelivery({ ...delivery, receivedAt: "2026-10-31T23:00:00.000Z", outcome: "processed" });
    await repo.recordDelivery({ ...delivery, receivedAt: "2026-11-09T12:05:00.000Z", outcome: "failed", error: "sin teléfono" });
    expect((await repo.deliveries(tenant, id, 10)).map((item) => [item.outcome, item.error, item.notes])).toEqual([["failed", "sin teléfono", ["nota"]], ["processed", null, ["nota"]]]);
    expect((await repo.usage(tenant, "2026-11-01T00:00:00.000Z")).get(id)).toEqual({ count: 1, lastReceivedAt: "2026-11-09T12:05:00.000Z" });

    expect(await repo.remove(tenant, id)).toBe(true);
    expect((await sql.query("select count(*)::int as n from inbound_webhook_deliveries where webhook_id = $1", [id])).rows[0]).toEqual({ n: 0 });
  });
});
