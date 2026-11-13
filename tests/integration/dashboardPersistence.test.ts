import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlAdsRepository } from "../../infrastructure/persistence/sql/SqlAdsRepository.js";
import { SqlDashboardAds } from "../../infrastructure/persistence/sql/SqlDashboardAds.js";
import { SqlDashboardAttention } from "../../infrastructure/persistence/sql/SqlDashboardAttention.js";
import { SqlDashboardSales } from "../../infrastructure/persistence/sql/SqlDashboardSales.js";
import { SqlFxRates } from "../../infrastructure/persistence/sql/SqlFxRates.js";
import { AdsDashboardService } from "../../domains/analytics/application/AdsDashboardService.js";
import { AttentionDashboardService } from "../../domains/analytics/application/AttentionDashboardService.js";
import { SalesDashboardService } from "../../domains/analytics/application/SalesDashboardService.js";
import { SalesExportService } from "../../domains/analytics/application/SalesExportService.js";
import { periodOf } from "../../domains/analytics/application/DashboardPeriod.js";
import { SqlSalesExport } from "../../infrastructure/persistence/sql/SqlSalesExport.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// El Dashboard en PostgreSQL (rama `test`): un anuncio de Meta con su gasto,
// un chat que llegó por ese anuncio y su venta (con costo), una venta en
// dólares que se convierte con la tasa del día, y la atención del asesor.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const TZ = async () => "America/Bogota";
const NOW = () => new Date("2026-11-10T22:00:00.000Z");
const AGENT = "00000000-0000-4000-8000-0000000000aa";

async function seed(): Promise<string> {
  const q = async <T = { id: string }>(text: string, params: unknown[]) => (await sql.query<T & Record<string, unknown>>(text, params)).rows[0] as T;
  const tenant = (await q("insert into tenants (key, name) values ($1, 'dash') returning id", [TEST_KEY_PREFIX + "dash"])).id;
  const connection = "11111111-1111-4111-8111-111111111111";
  await q("insert into whatsapp_connections (id, tenant_id, name, method, status) values ($1, $2, 'Ventas 1', 'qr', 'connected') returning id", [connection, tenant]);
  const contact = (await q(`insert into contacts (tenant_id, channel, external_key, name, phone, ad_origin) values ($1, 'whatsapp', '573001112233', 'Laura', '573001112233', '{"sourceId":"ad-9"}') returning id`, [tenant])).id;
  const conversation = "22222222-2222-4222-8222-222222222222";
  await q("insert into conversations (id, tenant_id, connection_id, contact_id, phone, created_at, last_message_author, last_message_at) values ($1, $2, $3, $4, '573001112233', '2026-11-02T14:00:00Z', 'contact', '2026-11-03T10:00:00Z') returning id", [conversation, tenant, connection, contact]);
  for (const [author, at, agent] of [["contact", "2026-11-02T14:00:00Z", null], ["bot", "2026-11-02T14:00:05Z", null], ["agent", "2026-11-02T14:06:00Z", AGENT]] as const) {
    await q("insert into conversation_messages (id, tenant_id, conversation_id, direction, author, kind, status, agent_id, agent_name, created_at) values (gen_random_uuid(), $1, $2, $3, $4, 'text', $5, $6, 'Sofía', $7) returning id",
      [tenant, conversation, author === "contact" ? "inbound" : "outbound", author, author === "contact" ? "received" : "sent", agent, at]);
  }
  const product = (await q("insert into products (tenant_id, name) values ($1, 'Video') returning id", [tenant])).id;
  await q("insert into product_prices (product_id, tenant_id, country, currency, amount, cost) values ($1, $2, 'CO', 'COP', 50000, 10000), ($1, $2, 'VE', 'USD', 12, 2) returning product_id as id", [product, tenant]);
  const sale = (currency: string, amount: number, country: string, ad: string | null, at: string) =>
    q("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, country, contact_id, connection_id, ad_source_id, recorded_by, sold_at) values ($1, 'approved', 'receipt', $2, 'Video', $3, $4, $5, $6, $7, $8, $9, $10) returning id",
      [tenant, product, amount, currency, country, contact, connection, ad, AGENT, at]);
  await sale("COP", 50000, "CO", "ad-9", "2026-11-04T16:00:00Z");
  await sale("USD", 12, "VE", null, "2026-11-05T16:00:00Z");
  await q("insert into fx_rates (day, currency, per_usd) values ('2026-11-01', 'COP', 4000) on conflict do nothing returning day::text as id", []);

  const ads = new SqlAdsRepository(sql);
  await ads.upsertAccounts(tenant, [{ externalId: "act_1", name: "Cuenta", currency: "COP", timezone: "America/Bogota", providerStatus: 1 }]);
  const [account] = await ads.accounts(tenant);
  await ads.setEnabled(tenant, account!.id, true);
  await ads.saveEntities(tenant, account!.id, [
    { level: "campaign", externalId: "camp-1", parentId: null, campaignId: "camp-1", name: "Video Colombia", status: "ACTIVE", dailyBudget: 15000, thumbnailUrl: null },
    { level: "adset", externalId: "set-1", parentId: "camp-1", campaignId: "camp-1", name: "Mamás", status: "ACTIVE", dailyBudget: null, thumbnailUrl: null },
    { level: "ad", externalId: "ad-9", parentId: "set-1", campaignId: "camp-1", name: "Tu canción", status: "ACTIVE", dailyBudget: null, thumbnailUrl: "https://x/t.jpg" }
  ]);
  await ads.saveInsights(tenant, account!.id, "2026-11-01", "2026-11-10", [
    { adId: "ad-9", day: "2026-11-02", spend: 10000, impressions: 5000, clicks: 150, conversations: 12, metaPurchases: 0, metaRevenue: 0 }
  ]);
  return tenant;
}

beforeAll(() => {
  sql = createTestSqlClient();
});

beforeEach(async () => {
  await cleanupTestData(sql);
  await sql.query("delete from fx_rates where day = '2026-11-01'");
});

afterAll(async () => {
  await cleanupTestData(sql);
  await sql.query("delete from fx_rates where day = '2026-11-01'");
  await sql.close();
});

describe("Dashboard en PostgreSQL", () => {
  it("Ventas, Anuncios y Atención con datos reales de la base", async () => {
    const tenant = await seed();
    const fx = new SqlFxRates(sql, async () => { throw new Error("sin red en la prueba"); });
    const adsReader = new SqlDashboardAds(sql);
    const filters = { from: "2026-11-01", to: "2026-11-10" };

    const sales = await new SalesDashboardService(new SqlDashboardSales(sql), adsReader, fx, TZ, NOW).overview({ tenantId: tenant, canSeeAds: true }, filters);
    expect(sales.currency).toBe("COP");
    // 50.000 COP + 12 USD × 4.000 = 98.000 COP.
    expect(sales.revenue.value).toBe(98000);
    expect(sales.ads).toMatchObject({ spend: { value: 10000 }, revenue: { value: 50000 }, roas: 5, costPerSale: 10000, costPerChat: 833.33, chats: 12, attributedSales: 1 });
    // Ganancia real: 98.000 − costos (10.000 + 2 USD = 8.000) − 10.000 de anuncios.
    expect(sales.realProfit).toBe(70000);
    expect(sales.leads).toMatchObject({ value: 1 });
    expect(sales.leadsFromAds).toBe(1);
    // Un lead con dos compras: 100 % (antes daba 200 %: ventas ÷ leads).
    expect([sales.conversion, sales.convertedLeads]).toEqual([1, 1]);
    expect(sales.recentSales[1]).toMatchObject({ adName: "Tu canción", connectionName: "Ventas 1" });
    expect(sales.byHour[11]).toBe(2);

    const ads = await new AdsDashboardService(adsReader, fx, TZ, NOW).performance(tenant, filters, "adset");
    expect(ads.rows).toEqual([expect.objectContaining({ id: "set-1", name: "Mamás", parentName: "Video Colombia", spend: 10000, sales: 1, revenue: 50000, roas: 5, chats: 12 })]);
    expect(ads).toMatchObject({ unseenSales: 1, lateShare: 1, connected: true });

    const attention = await new AttentionDashboardService(new SqlDashboardAttention(sql), fx, TZ, NOW).overview(tenant, filters);
    expect(attention).toMatchObject({ leads: { value: 1 }, attendedByAgents: { value: 1 }, botOnly: 0, unanswered: 1, firstResponseMinutes: 6 });
    expect(attention.heatmap[0]![4]).toBe(1);
    expect(attention.agents).toEqual([expect.objectContaining({ userId: AGENT, name: "Sofía", attended: 1, responseMinutes: 6, sales: 2, revenue: 98000 })]);
    expect(attention.connections).toEqual([expect.objectContaining({ name: "Ventas 1", connected: true, leads: 1, attended: 1, unanswered: 1 })]);
  });

  it("Descargar ventas: cada venta con su número, anuncio, campaña, hora local y el monto convertido", async () => {
    const tenant = await seed();
    const fx = new SqlFxRates(sql, async () => { throw new Error("sin red en la prueba"); });
    const table = await new SalesExportService(new SqlSalesExport(sql), new SqlDashboardAds(sql), fx, TZ, undefined, NOW).export(tenant, { from: "2026-11-01", to: "2026-11-10" });
    expect(table).toMatchObject({ name: "ventas_2026-11-01_a_2026-11-10", currency: "COP", truncated: false, missingRates: [] });
    const at = (column: string) => table.columns.indexOf(column);
    // De la más nueva a la más vieja; 16:00 UTC son las 11:00 en Bogotá.
    const [usd, cop] = table.rows;
    expect([usd![at("Fecha")], usd![at("Hora")], usd![at("Monto")], usd![at("Moneda")], usd![at("Monto en COP")], usd![at("Origen")]]).toEqual(["2026-11-05", "11:00", 12, "USD", 48000, "Orgánica"]);
    expect([cop![at("Número de WhatsApp")], cop![at("Origen")], cop![at("Campaña")], cop![at("Anuncio")], cop![at("Cómo se registró")]]).toEqual(["Ventas 1", "Anuncio", "Video Colombia", "Tu canción", "Comprobante en el chat"]);
  });

  it("lo que llegó a Auream por cada anuncio (frente a lo que cobró Meta) y si el negocio anota ventas", async () => {
    const tenant = await seed();
    const reader = new SqlDashboardAds(sql);
    const november = periodOf("2026-11-01", "2026-11-10", "America/Bogota", NOW());
    const arrived = async (ad: string, at: Record<string, string>, phone: string) =>
      sql.query("insert into contacts (tenant_id, channel, external_key, name, phone, ad_origin, created_at) values ($1, 'whatsapp', $2, $2, $2, $3::jsonb, $4)", [tenant, phone, JSON.stringify({ sourceId: ad, ...at }), "2026-11-03T15:00:00Z"]);
    // Laura (la del sembrado) llegó por el anuncio el 2 de noviembre; otro cliente, sin fecha anotada, se creó el 3.
    await sql.query(`update contacts set ad_origin = ad_origin || '{"receivedAt":"2026-11-02T14:00:00.000Z"}'::jsonb where tenant_id = $1`, [tenant]);
    await arrived("ad-9", {}, "573000000011");
    await arrived("ad-9", { receivedAt: "2026-10-20T10:00:00.000Z" }, "573000000012"); // llegó antes del periodo
    await arrived("ad-de-otra-cuenta", { receivedAt: "2026-11-02T10:00:00.000Z" }, "573000000013"); // un anuncio que Auream no sincroniza

    expect(await reader.arrivals(tenant, november, "campaign")).toEqual([{ id: "camp-1", chats: 2 }]);
    expect(await reader.arrivals(tenant, november, "adset")).toEqual([{ id: "set-1", chats: 2 }]);
    expect(await reader.arrivals(tenant, november, "ad")).toEqual([{ id: "ad-9", chats: 2 }]);
    // Por número: solo Laura tiene un chat en «Ventas 1». Por campaña: las de otra no cuentan.
    expect(await reader.arrivals(tenant, november, "ad", { connectionIds: ["11111111-1111-4111-8111-111111111111"] })).toEqual([{ id: "ad-9", chats: 1 }]);
    expect(await reader.arrivals(tenant, november, "ad", { campaignIds: ["camp-otra"] })).toEqual([]);

    expect(await reader.recordsSales(tenant, new Date("2026-11-01T05:00:00Z"), new Date("2026-11-11T05:00:00Z"))).toBe(true);
    expect(await reader.recordsSales(tenant, new Date("2026-09-01T05:00:00Z"), new Date("2026-10-01T05:00:00Z"))).toBe(false);

    // Meta cobró 12 chats y a Auream llegaron 2: aún no se juzga el anuncio, aunque ya tenga una venta.
    const fx = new SqlFxRates(sql, async () => { throw new Error("sin red en la prueba"); });
    const ads = await new AdsDashboardService(reader, fx, TZ, NOW).performance(tenant, { from: "2026-11-01", to: "2026-11-10" }, "ad");
    expect(ads.measurement).toEqual({ state: "partial", metaChats: 12, arrivedChats: 2, metaPurchases: 0 });
    expect(ads.rows[0]).toMatchObject({ id: "ad-9", advice: "partial", arrivedChats: 2, sales: 1, roas: 5 });
  });

  it("conversión: de los leads nuevos, cuántos compraron (por contacto o, a mano, por teléfono) dentro del periodo", async () => {
    const q = async (text: string, params: unknown[]) => (await sql.query<{ id: string }>(text, params)).rows[0]!.id;
    const tenant = await q("insert into tenants (key, name) values ($1, 'conv') returning id", [TEST_KEY_PREFIX + "conv"]);
    const connection = await q("insert into whatsapp_connections (id, tenant_id, name, method, status) values (gen_random_uuid(), $1, 'Ventas', 'qr', 'connected') returning id", [tenant]);
    const lead = async (phone: string) => {
      const contact = await q("insert into contacts (tenant_id, channel, external_key, name, phone) values ($1, 'whatsapp', $2, $2, $2) returning id", [tenant, phone]);
      await q("insert into conversations (id, tenant_id, connection_id, contact_id, phone, created_at) values (gen_random_uuid(), $1, $2, $3, $4, '2026-11-03T14:00:00Z') returning id", [tenant, connection, contact, phone]);
      return contact;
    };
    const product = await q("insert into products (tenant_id, name) values ($1, 'Video') returning id", [tenant]);
    const sale = (contact: string | null, phone: string | null, at: string) =>
      q("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, contact_id, customer_phone, sold_at) values ($1, 'approved', $2, $3, 'Video', 1000, 'COP', $4, $5, $6) returning id", [tenant, contact ? "receipt" : "manual", product, contact, phone, at]);
    await sale(await lead("573000000001"), null, "2026-11-04T10:00:00Z"); // compró por el flujo
    await lead("573000000002");
    await sale(null, "573000000002", "2026-11-05T10:00:00Z"); // venta anotada a mano, por su teléfono
    await lead("573000000003"); // no compró
    await sale(await lead("573000000004"), null, "2026-12-01T10:00:00Z"); // compró, pero después del periodo

    const counts = await new SqlDashboardSales(sql).leads(tenant, { fromDay: "2026-11-01", toDay: "2026-11-10", from: new Date("2026-11-01T05:00:00Z"), until: new Date("2026-11-11T05:00:00Z"), days: 10 }, {});
    expect(counts).toEqual({ total: 4, fromAds: 0, converted: 2 });
  });
});
