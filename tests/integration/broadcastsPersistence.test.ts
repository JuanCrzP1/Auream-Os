import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlBroadcastAudience } from "../../infrastructure/persistence/sql/SqlBroadcastAudience.js";
import { SqlBroadcastRecipients } from "../../infrastructure/persistence/sql/SqlBroadcastRecipients.js";
import { SqlBroadcastRepository } from "../../infrastructure/persistence/sql/SqlBroadcastRepository.js";
import { SqlBroadcastResults } from "../../infrastructure/persistence/sql/SqlBroadcastResults.js";
import { SqlSavedAudiences } from "../../infrastructure/persistence/sql/SqlSavedAudiences.js";
import { DEFAULT_BROADCAST_SETTINGS, EMPTY_AUDIENCE } from "../../contracts/BroadcastContracts.js";
import type { Broadcast } from "../../domains/broadcasts/domain/Broadcast.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Difusiones en PostgreSQL (rama `test`): la audiencia sale de quien escribió
// (con etiquetas, días y sin los que pidieron salir), la lista no se duplica,
// tomar el siguiente es atómico, el tope cuenta lo enviado hoy, y los
// resultados leen entregado/leído de la bandeja, la respuesta del cliente y
// la venta de los 3 días siguientes.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const CONNECTION = "33333333-3333-4333-8333-333333333333";
const q = async (text: string, params: unknown[] = []) => (await sql.query<{ id: string }>(text, params)).rows[0]!;

async function seed() {
  const tenant = (await q("insert into tenants (key, name) values ($1, 'difusiones') returning id", [TEST_KEY_PREFIX + "bc"])).id;
  await q("insert into whatsapp_connections (id, tenant_id, name, method, status) values ($1, $2, 'Ventas 1', 'qr', 'connected') returning id", [CONNECTION, tenant]);
  const label = (await q("insert into contact_labels (tenant_id, name) values ($1, 'Interesado') returning id", [tenant])).id;
  const people: Record<string, { contact: string; chat: string }> = {};
  for (const [name, phone, wroteDaysAgo, labeled] of [["Laura", "573001110001", 2, true], ["Andrés", "573001110002", 5, true], ["Mario", "573001110003", 90, true], ["Sin etiqueta", "573001110004", 1, false], ["Pidió salir", "573001110005", 1, true]] as const) {
    const contact = (await q("insert into contacts (tenant_id, channel, external_key, name, phone) values ($1, 'whatsapp', $2, $3, $2) returning id", [tenant, phone, name])).id;
    if (labeled) await q("insert into contact_label_assignments (tenant_id, contact_id, label_id) values ($1, $2, $3) returning contact_id as id", [tenant, contact, label]);
    const chat = (await q("insert into conversations (id, tenant_id, connection_id, contact_id, phone) values (gen_random_uuid(), $1, $2, $3, $4) returning id", [tenant, CONNECTION, contact, phone])).id;
    await q("insert into conversation_messages (id, tenant_id, conversation_id, direction, author, kind, status, created_at) values (gen_random_uuid(), $1, $2, 'inbound', 'contact', 'text', 'received', now() - make_interval(days => $3)) returning id", [tenant, chat, wroteDaysAgo]);
    people[name] = { contact, chat };
  }
  await q("insert into broadcast_opt_outs (tenant_id, phone) values ($1, '573001110005') returning phone as id", [tenant]);
  return { tenant, label, people };
}

const broadcast = (tenant: string, id: string): Broadcast => ({
  id, tenantId: tenant, name: "Promo", variants: [{ kind: "message", text: "Hola", media: null }], audience: EMPTY_AUDIENCE, connectionIds: [CONNECTION], scheduledAt: null,
  settings: DEFAULT_BROADCAST_SETTINGS, abTest: null, followUp: null, status: "scheduled", statusReason: null, parentId: null, winner: null, decidesAt: null,
  followUpDueAt: null, followUpChildId: null, startedAt: null, finishedAt: null, createdBy: null, createdAt: new Date().toISOString()
});

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(() => cleanupTestData(sql));
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("Difusiones en PostgreSQL", () => {
  it("la audiencia: quien escribió, con la etiqueta, en los últimos días, sin los que pidieron salir", async () => {
    const { tenant, label } = await seed();
    const audience = new SqlBroadcastAudience(sql);
    const all = await audience.resolve(tenant, EMPTY_AUDIENCE, [CONNECTION], 100);
    expect(all.candidates).toHaveLength(4);
    expect(all.optedOut).toBe(1);
    const filtered = await audience.resolve(tenant, { ...EMPTY_AUDIENCE, labelIds: [label], lastInboundDays: 30 }, [CONNECTION], 100);
    expect(filtered.candidates.map((c) => c.name).sort()).toEqual(["Andrés", "Laura"]);
    expect(await audience.has(tenant, "573001110005")).toBe(true);
  });

  it("lista, envío atómico, tope del día y resultados del envío a la venta", async () => {
    const { tenant, people } = await seed();
    const repo = new SqlBroadcastRepository(sql);
    const recipients = new SqlBroadcastRecipients(sql);
    const id = "44444444-4444-4444-8444-444444444444";
    await repo.create(broadcast(tenant, id));
    expect(await repo.transition(tenant, id, ["scheduled"], "sending", { startedAt: new Date().toISOString() })).toBe(true);
    expect(await repo.transition(tenant, id, ["scheduled"], "sending")).toBe(false);

    const { candidates } = await new SqlBroadcastAudience(sql).resolve(tenant, EMPTY_AUDIENCE, [CONNECTION], 100);
    const list = candidates.map((c) => ({ ...c, variant: 0 }));
    expect(await recipients.insert(tenant, id, list)).toBe(4);
    expect(await recipients.insert(tenant, id, list)).toBe(0);

    const now = new Date();
    const [a, b] = await Promise.all([recipients.claimNext(tenant, id, CONNECTION, now), recipients.claimNext(tenant, id, CONNECTION, now)]);
    expect(a!.id).not.toBe(b!.id);
    // Laura: le llegó, lo leyó, respondió y compró al día siguiente.
    const laura = [a!, b!].find((r) => r.name === "Laura") ?? (await recipients.claimNext(tenant, id, CONNECTION, now))!;
    await recipients.finish(tenant, laura.id, { status: "sent", providerMessageId: "wamid.1", error: null, at: now });
    await q("insert into conversation_messages (id, tenant_id, conversation_id, direction, author, kind, status, provider_message_id, created_at) values (gen_random_uuid(), $1, $2, 'outbound', 'bot', 'text', 'read', 'wamid.1', $3) returning id", [tenant, people["Laura"]!.chat, now]);
    await q("insert into conversation_messages (id, tenant_id, conversation_id, direction, author, kind, status, created_at) values (gen_random_uuid(), $1, $2, 'inbound', 'contact', 'text', 'received', $3::timestamptz + interval '5 minutes') returning id", [tenant, people["Laura"]!.chat, now]);
    const product = (await q("insert into products (tenant_id, name) values ($1, 'Video') returning id", [tenant])).id;
    await q("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, contact_id, sold_at) values ($1, 'approved', 'manual', $2, 'Video', 49900, 'COP', $3, $4::timestamptz + interval '1 day') returning id", [tenant, product, people["Laura"]!.contact, now]);
    for (const other of [a!, b!].filter((r) => r.id !== laura.id)) await recipients.finish(tenant, other.id, { status: "failed", providerMessageId: null, error: "Sin WhatsApp", at: now });

    expect(await recipients.sentSince(tenant, CONNECTION, new Date(now.getTime() - 60_000))).toBe(1);
    expect(await recipients.daysWithSends(tenant, CONNECTION, "America/Bogota")).toBe(1);
    expect((await recipients.work(tenant, id)).pendingByConnection).toEqual([CONNECTION]);

    const results = new SqlBroadcastResults(sql);
    const stats = (await results.stats(tenant, [id])).get(id)!;
    expect(stats).toMatchObject({ total: 4, sent: 1, delivered: 1, read: 1, replied: 1, bought: 1, revenue: [{ currency: "COP", amount: 49900 }] });
    const page = await results.recipients(tenant, id, "bought", 0, 50);
    expect(page.recipients).toEqual([expect.objectContaining({ name: "Laura", state: "bought", sale: { currency: "COP", amount: 49900 }, connectionName: "Ventas 1" })]);
    expect(page.counts).toMatchObject({ all: 4, bought: 1, replied: 1, read: 1, failed: (await recipients.attempts(tenant, id)).failed });

    expect(await recipients.cancelPending(tenant, id)).toBeGreaterThan(0);
    expect(await new SqlBroadcastAudience(sql).nonResponders(tenant, id, 10)).toEqual([]);
  });

  it("un solo segundo envío por difusión y audiencias guardadas", async () => {
    const { tenant } = await seed();
    const repo = new SqlBroadcastRepository(sql);
    const parent = "55555555-5555-4555-8555-555555555555";
    await repo.create(broadcast(tenant, parent));
    await repo.create({ ...broadcast(tenant, "66666666-6666-4666-8666-666666666666"), parentId: parent });
    await repo.create({ ...broadcast(tenant, "77777777-7777-4777-8777-777777777777"), parentId: parent });
    expect(await repo.childOf(tenant, parent)).toBe("66666666-6666-4666-8666-666666666666");

    const saved = new SqlSavedAudiences(sql);
    await saved.save(tenant, { id: "88888888-8888-4888-8888-888888888888", name: "VIP", audience: { ...EMPTY_AUDIENCE, countries: ["CO"] }, createdAt: new Date().toISOString() });
    expect((await saved.list(tenant))[0]).toMatchObject({ name: "VIP", audience: { countries: ["CO"] } });
    expect(await saved.remove(tenant, "88888888-8888-4888-8888-888888888888")).toBe(true);
  });
});
