import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlNotificationReads } from "../../infrastructure/persistence/sql/SqlNotificationReads.js";
import { SqlNotificationSignals } from "../../infrastructure/persistence/sql/SqlNotificationSignals.js";
import { NOTIFICATION_KINDS } from "../../contracts/NotificationContracts.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// La campana en PostgreSQL (rama `test`): números desconectados, ventas por
// revisar en un aviso, MIS seguimientos de hoy (día del negocio) y el «visto»
// de cada persona, que nunca retrocede.

let sql: SqlClient;
const ME = "99999999-0000-4000-8000-0000000000b1";
const OTHER = "99999999-0000-4000-8000-0000000000b2";

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(() => cleanupTestData(sql));
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("Notificaciones en PostgreSQL", () => {
  it("lee el estado de cada módulo y guarda el «visto»", async () => {
    const tenant = (await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, 'campana') returning id", [TEST_KEY_PREFIX + "bell"])).rows[0]!.id;
    await sql.query("insert into whatsapp_connections (id, tenant_id, name, method, status) values (gen_random_uuid(), $1, 'Ventas 1', 'qr', 'disconnected'), (gen_random_uuid(), $1, 'Ventas 2', 'qr', 'connected')", [tenant]);
    await sql.query("insert into sales (tenant_id, status, source, review_reason) values ($1, 'review', 'manual', 'Sin producto'), ($1, 'review', 'manual', 'Sin producto')", [tenant]);
    const contact = (await sql.query<{ id: string }>("insert into contacts (tenant_id, channel, external_key, name, phone) values ($1, 'whatsapp', '573009990001', 'Laura', '573009990001') returning id", [tenant])).rows[0]!.id;
    const now = new Date();
    const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);
    await sql.query(
      `insert into crm_follow_ups (tenant_id, contact_id, title, due_at, assignee_id) values
         ($1, $2, 'Vencido', $3, $5), ($1, $2, 'De otra persona', $3, $6), ($1, $2, 'La otra semana', $4, $5)`,
      [tenant, contact, hours(-2), hours(24 * 7), ME, OTHER]
    );

    const signals = await new SqlNotificationSignals(sql).read({ tenantId: tenant, userId: ME, kinds: new Set(NOTIFICATION_KINDS), timezone: "America/Bogota", now });
    expect(signals.find((s) => s.kind === "number_disconnected")).toMatchObject({ name: "Ventas 1" });
    expect(signals.filter((s) => s.kind === "number_disconnected")).toHaveLength(1);
    expect(signals.find((s) => s.kind === "sales_review")).toMatchObject({ count: 2 });
    expect(signals.find((s) => s.kind === "follow_ups_due")).toMatchObject({ count: 1, overdue: 1 });
    expect(await new SqlNotificationSignals(sql).read({ tenantId: tenant, userId: ME, kinds: new Set(["sales_review"]), timezone: "America/Bogota", now })).toHaveLength(1);

    const reads = new SqlNotificationReads(sql);
    expect(await reads.seenAt(tenant, ME)).toBeNull();
    await reads.markSeen(tenant, ME, hours(0));
    await reads.markSeen(tenant, ME, hours(-5));
    expect((await reads.seenAt(tenant, ME))!.getTime()).toBeGreaterThan(hours(-1).getTime());
    expect(await reads.seenAt(tenant, OTHER)).toBeNull();
  });
});
