import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlAuditEventStore } from "../../infrastructure/persistence/sql/SqlAuditEventStore.js";
import { SqlGroupMembers } from "../../infrastructure/persistence/sql/SqlGroupMembers.js";
import { SqlGroupResults } from "../../infrastructure/persistence/sql/SqlGroupResults.js";
import { SqlWaGroups } from "../../infrastructure/persistence/sql/SqlWaGroups.js";
import { AuditLogger } from "../../platform/observability/audit/AuditLogger.js";
import type { MemberQuery } from "../../domains/groups/application/GroupMemberPorts.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Los miembros de un grupo en PostgreSQL: quién está, quién se fue y quién
// compró MIENTRAS estaba (y que eso diga lo mismo que la tarjeta del grupo),
// tu número aparte, los ocultos contados, la búsqueda, la etiqueta sin repetir
// y el registro de auditoría de la descarga.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const CONNECTION = "44444444-4444-4444-8444-444444444441";
const GROUP = "66666666-6666-4666-8666-666666666661";
const OWN = "573009990000";
const BUYER = "573001110003";
const ANA = "573001110004";
const LEAVER = "573001110005";
const OLD = "573001110006";
const q = async (text: string, params: unknown[] = []) => (await sql.query<{ id: string }>(text, params)).rows[0]!;
const all = (extra: Partial<MemberQuery> = {}): MemberQuery => ({ filter: "all", search: null, offset: 0, limit: 50, ...extra });

beforeAll(() => {
  sql = createTestSqlClient();
});
beforeEach(() => cleanupTestData(sql));
afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

async function world() {
  const tenant = (await q("insert into tenants (key, name) values ($1, 'miembros') returning id", [TEST_KEY_PREFIX + "members"])).id;
  await q("insert into whatsapp_connections (id, tenant_id, name, method, status, phone_number) values ($1, $2, 'Ventas', 'qr', 'connected', $3) returning id", [CONNECTION, tenant, OWN]);
  const groups = new SqlWaGroups(sql);
  const t0 = new Date(Date.now() - 10 * 86_400_000);
  const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
  await groups.insertCreated({ id: GROUP, tenantId: tenant, connectionId: CONNECTION, jid: "120363000000000091@g.us", name: "Lanzamiento #1", description: "", imageUrl: null, members: 0, isAdmin: true, announce: true, locked: true, inviteLink: null, campaignId: null, position: null, syncedAt: t0.toISOString(), lastWelcomeAt: null, createdAt: t0.toISOString() });
  // Ya estaban cuando se trajo el grupo (sin fecha de entrada real). Quién es
  // administrador solo lo dice la sincronización (los avisos de entrada no).
  const synced = (phone: string, admin: boolean) =>
    q("insert into wa_group_members (tenant_id, group_id, member_key, phone, is_admin, source, joined_at) values ($1, $2, $3, $3, $4, 'sync', $5) returning member_key as id", [tenant, GROUP, phone, admin, t0]);
  await synced(OLD, false);
  await synced(OWN, true);
  await groups.applyMoves(tenant, GROUP, [{ key: BUYER, phone: BUYER, isAdmin: false }], [], at(2));
  await groups.applyMoves(tenant, GROUP, [{ key: ANA, phone: ANA, isAdmin: false }, { key: "lid:7", phone: null, isAdmin: false }], [], at(3));
  await groups.applyMoves(tenant, GROUP, [{ key: LEAVER, phone: LEAVER, isAdmin: false }], [], at(4));
  await groups.applyMoves(tenant, GROUP, [], [{ key: LEAVER, phone: LEAVER, isAdmin: false }], at(120));
  await q("insert into contacts (tenant_id, channel, external_key, phone, name) values ($1, 'whatsapp', $2, $2, 'Ana Gómez') returning id", [tenant, ANA]);
  const product = (await q("insert into products (tenant_id, name) values ($1, 'Video') returning id", [tenant])).id;
  const sale = (phone: string, amount: number, currency: string, when: Date) =>
    q("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, customer_phone, sold_at) values ($1, 'approved', 'manual', $2, 'Video', $3, $4, $5, $6) returning id", [tenant, product, amount, currency, phone, when]);
  await sale(BUYER, 49900, "COP", at(30));
  await sale(BUYER, 10, "USD", at(40));
  await sale(LEAVER, 25000, "COP", at(60)); // compró antes de irse: cuenta
  await sale(LEAVER, 99000, "COP", at(200)); // compró después de irse: no
  await sale(ANA, 70000, "COP", at(-60)); // compró antes de entrar: no
  return { tenant, members: new SqlGroupMembers(sql), results: new SqlGroupResults(sql) };
}

describe("Miembros de un grupo en PostgreSQL", () => {
  it("cada filtro con sus conteos; «compró» dice lo mismo que la tarjeta del grupo", async () => {
    const { tenant, members, results } = await world();
    const page = await members.page(tenant, GROUP, all());
    expect(page.counts).toEqual({ all: 4, buyers: 2, nonBuyers: 2, left: 1, admins: 1 });
    expect(page.hidden).toBe(1);
    // Los más nuevos primero; los que ya estaban, al final y sin fecha de entrada.
    expect(page.rows.map((row) => [row.phone, row.joinedAt === null])).toEqual([[ANA, false], [BUYER, false], [OLD, true], [OWN, true]]);
    expect(page.rows.find((row) => row.phone === ANA)).toMatchObject({ name: "Ana Gómez", contactId: expect.any(String), bought: [] });
    expect(page.rows.find((row) => row.phone === OWN)).toMatchObject({ isOwnNumber: true, isAdmin: true });
    expect(page.rows.find((row) => row.phone === BUYER)?.bought).toEqual([{ currency: "COP", amount: 49900 }, { currency: "USD", amount: 10 }]);

    const card = (await results.groups(tenant, [GROUP], null)).get(GROUP)!;
    expect(page.counts.buyers).toBe(card.buyers);
    const buyers = await members.page(tenant, GROUP, all({ filter: "buyers" }));
    const sum = (currency: string) => buyers.rows.flatMap((row) => row.bought).filter((entry) => entry.currency === currency).reduce((total, entry) => total + entry.amount, 0);
    expect(card.revenue).toEqual([{ currency: "COP", amount: sum("COP") }, { currency: "USD", amount: sum("USD") }]);
    expect(buyers.rows.find((row) => row.phone === LEAVER)).toMatchObject({ leftAt: expect.any(String), bought: [{ currency: "COP", amount: 25000 }] });

    expect((await members.page(tenant, GROUP, all({ filter: "nonBuyers" }))).rows.map((row) => row.phone)).toEqual([ANA, OLD]);
    expect((await members.page(tenant, GROUP, all({ filter: "left" }))).rows.map((row) => row.phone)).toEqual([LEAVER]);
    expect((await members.page(tenant, GROUP, all({ filter: "admins" }))).rows.map((row) => row.phone)).toEqual([OWN]);
  });

  it("busca por nombre (sin importar mayúsculas) o por parte del número; los comodines se buscan tal cual; pagina", async () => {
    const { tenant, members } = await world();
    expect((await members.page(tenant, GROUP, all({ search: "gÓMEZ" }))).rows.map((row) => row.phone)).toEqual([ANA]);
    expect((await members.page(tenant, GROUP, all({ search: "+57 300 1110003" }))).rows.map((row) => row.phone)).toEqual([BUYER]);
    expect((await members.page(tenant, GROUP, all({ search: "1110003" }))).rows.map((row) => row.phone)).toEqual([BUYER]);
    const wildcard = await members.page(tenant, GROUP, all({ search: "%" }));
    expect([wildcard.rows.length, wildcard.counts.all]).toEqual([0, 0]);
    const second = await members.page(tenant, GROUP, all({ offset: 3, limit: 2 }));
    expect(second.rows.map((row) => row.phone)).toEqual([OWN]);
  });

  it("la etiqueta: solo a los que aún no la tienen (sin importar mayúsculas), nunca a tu número", async () => {
    const { tenant, members } = await world();
    expect(await members.toLabel(tenant, GROUP, "nonBuyers", "No compró", 10)).toEqual({ phones: [ANA, OLD], total: 2 });
    expect(await members.toLabel(tenant, GROUP, "all", "No compró", 1)).toEqual({ phones: [BUYER], total: 3 });
    const label = (await q("insert into contact_labels (tenant_id, name) values ($1, 'no compró') returning id", [tenant])).id;
    const ana = (await q("select id from contacts where tenant_id = $1 and external_key = $2", [tenant, ANA])).id;
    await q("insert into contact_label_assignments (tenant_id, contact_id, label_id) values ($1, $2, $3) returning label_id as id", [tenant, ana, label]);
    expect(await members.toLabel(tenant, GROUP, "nonBuyers", "No Compró", 10)).toEqual({ phones: [OLD], total: 1 });
  });

  it("nada de otra cuenta: otro tenant no ve los miembros", async () => {
    const { members } = await world();
    const other = (await q("insert into tenants (key, name) values ($1, 'otra') returning id", [TEST_KEY_PREFIX + "members-other"])).id;
    const page = await members.page(other, GROUP, all());
    expect([page.rows.length, page.hidden, page.counts.all]).toEqual([0, 0, 0]);
  });

  it("la auditoría de una descarga queda guardada, la más reciente primero, y solo en su cuenta", async () => {
    const { tenant } = await world();
    const store = new SqlAuditEventStore(sql);
    let clock = Date.now();
    const audit = new AuditLogger(store, () => new Date((clock += 1000)));
    await audit.recordDataExport(tenant, "dev-user", "req-1", { kind: "group_members", subjectId: GROUP, rows: 4, filters: { filter: "all" } });
    await audit.recordDataExport(tenant, "user-2", "req-2", { kind: "sales", subjectId: null, rows: 9 });
    const events = await store.findByType(tenant, "data.exported");
    expect(events.map((event) => [event.actorId, event.metadata["kind"], event.metadata["rows"]])).toEqual([["user-2", "sales", 9], ["dev-user", "group_members", 4]]);
    const other = (await q("insert into tenants (key, name) values ($1, 'otra') returning id", [TEST_KEY_PREFIX + "audit-other"])).id;
    expect(await store.findByTenant(other)).toEqual([]);
  });
});
