import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlSalesLineRepository } from "../../infrastructure/persistence/sql/SqlSalesLineRepository.js";
import { SqlAdsRepository } from "../../infrastructure/persistence/sql/SqlAdsRepository.js";
import { SqlDashboardAds } from "../../infrastructure/persistence/sql/SqlDashboardAds.js";
import { SqlDashboardSales } from "../../infrastructure/persistence/sql/SqlDashboardSales.js";
import { SqlFxRates } from "../../infrastructure/persistence/sql/SqlFxRates.js";
import { SalesLineServices } from "../../domains/sales-lines/application/SalesLineServices.js";
import { SalesDashboardService } from "../../domains/analytics/application/SalesDashboardService.js";
import { DashboardScopeResolver } from "../../domains/analytics/application/DashboardScopeResolver.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Líneas de venta en PostgreSQL y el Dashboard de una línea: solo las ventas
// de sus productos, el gasto de sus campañas y, como ventas por anuncio, las
// que trajeron esas campañas. En otra moneda si se pide.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const TZ = async () => "America/Bogota";
const NOW = () => new Date("2026-11-10T22:00:00.000Z");

async function seed() {
  const q = async (text: string, params: unknown[]) => (await sql.query<{ id: string }>(text, params)).rows[0]!.id;
  const tenant = await q("insert into tenants (key, name) values ($1, 'lineas') returning id", [TEST_KEY_PREFIX + "lineas"]);
  const product = (name: string) => q("insert into products (tenant_id, name) values ($1, $2) returning id", [tenant, name]);
  const [venezuela, colombia] = [await product("Mega Pack"), await product("Video")];
  const sale = (productId: string, amount: number, ad: string | null) =>
    q("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, ad_source_id, sold_at) values ($1, 'approved', 'receipt', $2, 'x', $3, 'COP', $4, '2026-11-04T16:00:00Z') returning id", [tenant, productId, amount, ad]);
  await sale(venezuela, 40000, "ad-ve");
  await sale(venezuela, 10000, null);
  await sale(colombia, 90000, "ad-co");
  const ads = new SqlAdsRepository(sql);
  await ads.upsertAccounts(tenant, [{ externalId: "act_1", name: "Cuenta", currency: "COP", timezone: "America/Bogota", providerStatus: 1 }]);
  const [account] = await ads.accounts(tenant);
  await ads.setEnabled(tenant, account!.id, true);
  await ads.saveEntities(tenant, account!.id, [
    { level: "campaign", externalId: "111", parentId: null, campaignId: "111", name: "Venezuela", status: "ACTIVE", dailyBudget: null, thumbnailUrl: null },
    { level: "campaign", externalId: "222", parentId: null, campaignId: "222", name: "Colombia", status: "ACTIVE", dailyBudget: null, thumbnailUrl: null },
    { level: "ad", externalId: "ad-ve", parentId: "111", campaignId: "111", name: "Anuncio VE", status: "ACTIVE", dailyBudget: null, thumbnailUrl: null },
    { level: "ad", externalId: "ad-co", parentId: "222", campaignId: "222", name: "Anuncio CO", status: "ACTIVE", dailyBudget: null, thumbnailUrl: null }
  ]);
  await ads.saveInsights(tenant, account!.id, "2026-11-01", "2026-11-10", [
    { adId: "ad-ve", day: "2026-11-02", spend: 8000, impressions: 1000, clicks: 50, conversations: 4, metaPurchases: 0, metaRevenue: 0 },
    { adId: "ad-co", day: "2026-11-02", spend: 30000, impressions: 3000, clicks: 90, conversations: 9, metaPurchases: 0, metaRevenue: 0 }
  ]);
  await sql.query("insert into fx_rates (day, currency, per_usd) values ('2026-11-01', 'COP', 4000) on conflict do nothing", []);
  return { tenant, venezuela, colombia };
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

describe("líneas de venta en PostgreSQL", () => {
  it("guarda, lista por nombre, no repite nombres y el Dashboard de la línea mide solo lo suyo", async () => {
    const { tenant, venezuela } = await seed();
    const lines = new SalesLineServices(new SqlSalesLineRepository(sql));
    const line = await lines.create(tenant, { name: "Venezuela", color: "#e0a400", productIds: [venezuela], campaignIds: ["111"] });
    await expect(lines.create(tenant, { name: " VENEZUELA ", productIds: [venezuela] })).rejects.toBeInstanceOf(ConflictError);
    expect((await lines.list(tenant, true)).lines.map((item) => [item.name, item.productIds, item.campaignIds])).toEqual([["Venezuela", [venezuela], ["111"]]]);

    const lookup = { scopeOf: async (t: string, id: string) => lines.find(t, id) };
    const ads = new SqlDashboardAds(sql);
    const fx = new SqlFxRates(sql, async () => { throw new Error("sin red en la prueba"); });
    const dashboard = new SalesDashboardService(new SqlDashboardSales(sql), ads, fx, TZ, NOW, new DashboardScopeResolver(lookup));
    const filters = { from: "2026-11-01", to: "2026-11-10" };

    const all = await dashboard.overview({ tenantId: tenant, canSeeAds: true }, filters);
    expect([all.revenue.value, all.ads?.spend.value, all.ads?.activeCampaigns]).toEqual([140000, 38000, 2]);

    // La línea: 50.000 de Mega Pack (40.000 por su anuncio + 10.000 orgánico), con el gasto de SU campaña.
    const view = await dashboard.overview({ tenantId: tenant, canSeeAds: true }, { ...filters, lineId: line.id });
    expect([view.revenue.value, view.sales.value]).toEqual([50000, 2]);
    expect(view.ads).toMatchObject({ spend: { value: 8000 }, revenue: { value: 40000 }, roas: 5, activeCampaigns: 1 });

    // En dólares (4.000 COP por dólar).
    const usd = await dashboard.overview({ tenantId: tenant, canSeeAds: true }, { ...filters, lineId: line.id, currency: "usd" });
    expect([usd.currency, usd.revenue.value, usd.ads?.spend.value]).toEqual(["USD", 12.5, 2]);

    await lines.remove(tenant, line.id);
    expect((await lines.list(tenant, true)).lines).toEqual([]);
  });
});
