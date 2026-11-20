import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlPushAudience } from "../../infrastructure/persistence/sql/SqlPushAudience.js";
import { SqlPushDevices, SqlPushPreferences } from "../../infrastructure/persistence/sql/SqlPushDevices.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Los avisos al celular en PostgreSQL: un dispositivo por navegador (si cambia
// de persona, pasa a la nueva), cada uno quita solo los suyos, las
// preferencias por empresa, y lo que lee cada aviso (quién está, quién atiende
// un chat, un seguimiento) nunca cruza de empresa.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const ME = "aaaaaaaa-1111-4111-8111-111111111111";
const OTHER = "aaaaaaaa-2222-4222-8222-222222222222";
const CONNECTION = "44444444-4444-4444-8444-444444444491";
const q = async (text: string, params: unknown[] = []) => (await sql.query<{ id: string }>(text, params)).rows[0]!;
const endpoint = (n: number) => `https://fcm.googleapis.com/fcm/send/it-${n}-${Date.now()}`;
const KEYS = { p256dh: "B".repeat(87), auth: "a".repeat(22) };

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(async () => {
  await cleanupTestData(sql);
  await sql.query("delete from push_subscriptions where user_id = any($1::uuid[])", [[ME, OTHER]]);
});
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.query("delete from push_subscriptions where user_id = any($1::uuid[])", [[ME, OTHER]]);
  await sql.close();
});

describe("Avisos al celular en PostgreSQL", () => {
  it("dispositivos: uno por navegador, pasa a quien se suscribe, cada uno quita solo los suyos", async () => {
    const devices = new SqlPushDevices(sql);
    const url = endpoint(1);
    const id = await devices.save({ userId: ME, endpoint: url, ...KEYS, label: "Chrome en Mac" });
    expect(await devices.save({ userId: OTHER, endpoint: url, ...KEYS, label: "Chrome en Mac" })).toBe(id);
    expect(await devices.listForUser(ME)).toEqual([]);
    expect((await devices.listForUser(OTHER)).map((d) => [d.id, d.label, d.lastUsedAt])).toEqual([[id, "Chrome en Mac", null]]);

    expect(await devices.remove(ME, id)).toBe(false);
    await devices.touch(id, new Date("2026-11-20T12:00:00.000Z"));
    expect((await devices.listForUsers([OTHER, ME]))[0]?.lastUsedAt).toBe("2026-11-20T12:00:00.000Z");
    await devices.forget(id);
    expect(await devices.listForUser(OTHER)).toEqual([]);
    await expect(sql.query("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'http://inseguro', $2, $3)", [ME, KEYS.p256dh, KEYS.auth])).rejects.toThrow();
  });

  it("preferencias por persona y empresa: sin fila, prendido; apagar en una empresa no apaga en otra", async () => {
    const t1 = (await q("insert into tenants (key, name) values ($1, 'a') returning id", [TEST_KEY_PREFIX + "push-a"])).id;
    const t2 = (await q("insert into tenants (key, name) values ($1, 'b') returning id", [TEST_KEY_PREFIX + "push-b"])).id;
    const prefs = new SqlPushPreferences(sql);
    await prefs.set(t1, ME, "chat_message", false, new Date());
    await prefs.set(t1, ME, "chat_message", false, new Date());
    await prefs.set(t1, OTHER, "chat_message", true, new Date());
    expect(await prefs.get(t1, ME)).toEqual(new Map([["chat_message", false]]));
    expect(await prefs.get(t2, ME)).toEqual(new Map());
    expect([...(await prefs.mutedAmong(t1, "chat_message", [ME, OTHER]))]).toEqual([ME]);
    expect([...(await prefs.mutedAmong(t2, "chat_message", [ME, OTHER]))]).toEqual([]);
  });

  it("lo que lee cada aviso: personas activas, quién atiende el chat, el número y el seguimiento; nada de otra empresa", async () => {
    const tenant = (await q("insert into tenants (key, name) values ($1, 'a') returning id", [TEST_KEY_PREFIX + "push-aud"])).id;
    const other = (await q("insert into tenants (key, name) values ($1, 'b') returning id", [TEST_KEY_PREFIX + "push-aud-b"])).id;
    await q("insert into memberships (user_id, tenant_id, role, status) values ($1, $2, 'operator', 'active'), ($3, $2, 'viewer', 'revoked'), ($4, $2, 'api_client', 'active') returning id", [ME, tenant, OTHER, "aaaaaaaa-3333-4333-8333-333333333333"]);
    await q("insert into whatsapp_connections (id, tenant_id, name, method, status) values ($1, $2, 'flujo 1', 'qr', 'connected') returning id", [CONNECTION, tenant]);
    const contact = (await q("insert into contacts (tenant_id, channel, external_key, phone, name) values ($1, 'whatsapp', '573001112233', '573001112233', 'Laura') returning id", [tenant])).id;
    await q("insert into conversations (id, tenant_id, connection_id, contact_id, phone, status, assignee_id) values (gen_random_uuid(), $1, $2, $3, '573001112233', 'attending', $4) returning id", [tenant, CONNECTION, contact, ME]);
    await q("insert into conversations (id, tenant_id, connection_id, phone, status) values (gen_random_uuid(), $1, $2, '573009999999', 'bot') returning id", [tenant, CONNECTION]);
    const followUp = (await q("insert into crm_follow_ups (tenant_id, contact_id, title, due_at, assignee_id) values ($1, $2, 'Llamar', '2026-11-21T15:00:00Z', $3) returning id", [tenant, contact, ME])).id;

    const audience = new SqlPushAudience(sql);
    expect(await audience.members(tenant)).toEqual([{ userId: ME, role: "operator" }]);
    expect(await audience.chatAttendant(tenant, CONNECTION, "573001112233")).toEqual({ conversationId: expect.any(String), assigneeId: ME, contactName: "Laura" });
    expect(await audience.chatAttendant(tenant, CONNECTION, "573009999999")).toBeNull();
    expect(await audience.connectionName(tenant, CONNECTION)).toBe("flujo 1");
    expect(await audience.followUp(tenant, followUp)).toEqual({ title: "Llamar", contactName: "Laura", assigneeId: ME, dueAt: "2026-11-21T15:00:00.000Z", doneAt: null });

    expect(await audience.members(other)).toEqual([]);
    expect(await audience.chatAttendant(other, CONNECTION, "573001112233")).toBeNull();
    expect(await audience.connectionName(other, CONNECTION)).toBeNull();
    expect(await audience.followUp(other, followUp)).toBeNull();
  });
});
