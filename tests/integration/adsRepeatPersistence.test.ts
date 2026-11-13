import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlAdsRepository } from "../../infrastructure/persistence/sql/SqlAdsRepository.js";
import { SqlRepeatPurchases } from "../../infrastructure/persistence/sql/SqlRepeatPurchases.js";
import { periodOf } from "../../domains/analytics/application/DashboardPeriod.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// «Con recompras» en PostgreSQL (rama `test`): la PRIMERA compra de cada
// cliente decide de qué anuncio es «nuevo»; sus recompras cuentan dentro de la
// ventana (vengan o no de un anuncio) y no después; un cliente que primero
// compró sin anuncio, o antes del periodo, no es nuevo de nadie; las compras
// por revisar no cuentan; y nada cruza de cuenta.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const TZ = "America/Bogota";

async function seed(key: string): Promise<string> {
  const q = async (text: string, params: unknown[]) => (await sql.query<{ id: string }>(text, params)).rows[0]!;
  const tenant = (await q("insert into tenants (key, name) values ($1, $1) returning id", [TEST_KEY_PREFIX + key])).id;
  const ads = new SqlAdsRepository(sql);
  await ads.upsertAccounts(tenant, [{ externalId: "act_1", name: "Cuenta", currency: "COP", timezone: TZ, providerStatus: 1 }]);
  const [account] = await ads.accounts(tenant);
  await ads.setEnabled(tenant, account!.id, true);
  await ads.saveEntities(tenant, account!.id, [
    { level: "campaign", externalId: "camp-1", parentId: null, campaignId: "camp-1", name: "Video", status: "ACTIVE", dailyBudget: null, thumbnailUrl: null },
    { level: "adset", externalId: "set-1", parentId: "camp-1", campaignId: "camp-1", name: "Mamás", status: "ACTIVE", dailyBudget: null, thumbnailUrl: null },
    { level: "ad", externalId: "ad-1", parentId: "set-1", campaignId: "camp-1", name: "Tu canción", status: "ACTIVE", dailyBudget: null, thumbnailUrl: null }
  ]);
  const product = (await q("insert into products (tenant_id, name) values ($1, 'Video') returning id", [tenant])).id;
  const contact = async (phone: string) => (await q("insert into contacts (tenant_id, channel, external_key, name, phone) values ($1, 'whatsapp', $2, $2, $2) returning id", [tenant, phone])).id;
  const sale = (who: string, amount: number, currency: string, ad: string | null, at: string, status = "approved") =>
    q("insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, contact_id, ad_source_id, sold_at) values ($1, $2, 'manual', $3, 'Video', $4, $5, $6, $7, $8) returning id", [tenant, status, product, amount, currency, who, ad, at]);

  // Ana: llega por el anuncio en octubre y recompra dos veces dentro de 60 días (una sin anuncio, otra en dólares) y una vez después.
  const ana = await contact("573000000001");
  await sale(ana, 100000, "COP", "ad-1", "2026-10-05T15:00:00Z");
  await sale(ana, 50000, "COP", null, "2026-10-20T15:00:00Z");
  await sale(ana, 10, "USD", "ad-1", "2026-11-10T15:00:00Z");
  await sale(ana, 999999, "COP", null, "2027-01-20T15:00:00Z");
  await sale(ana, 777777, "COP", null, "2026-10-21T15:00:00Z", "review");
  // Beto: llega por el anuncio y no vuelve.
  await sale(await contact("573000000002"), 80000, "COP", "ad-1", "2026-10-10T15:00:00Z");
  // Caro: su primera compra fue SIN anuncio; la segunda, por el anuncio: no es «nueva» del anuncio.
  const caro = await contact("573000000003");
  await sale(caro, 60000, "COP", null, "2026-10-02T15:00:00Z");
  await sale(caro, 60000, "COP", "ad-1", "2026-10-15T15:00:00Z");
  // Dani: llegó por el anuncio ANTES del periodo.
  await sale(await contact("573000000004"), 70000, "COP", "ad-1", "2026-09-15T15:00:00Z");
  return tenant;
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

describe("SqlRepeatPurchases", () => {
  it("clientes nuevos por su primera compra y sus recompras dentro de la ventana, por campaña, conjunto o anuncio", async () => {
    const tenant = await seed("repeat-a");
    const other = await seed("repeat-b");
    const reader = new SqlRepeatPurchases(sql);
    const october = periodOf("2026-10-01", "2026-10-31", TZ, new Date("2026-11-12T22:00:00Z"));

    const money = await reader.money(tenant, october, "campaign", 60, TZ);
    const sorted = [...money].sort((a, b) => a.day.localeCompare(b.day));
    expect(sorted).toEqual([
      { id: "camp-1", kind: "first", day: "2026-10-05", currency: "COP", amount: 100000 },
      { id: "camp-1", kind: "first", day: "2026-10-10", currency: "COP", amount: 80000 },
      { id: "camp-1", kind: "repeat", day: "2026-10-20", currency: "COP", amount: 50000 },
      { id: "camp-1", kind: "repeat", day: "2026-11-10", currency: "USD", amount: 10 }
    ]);
    expect(await reader.counts(tenant, october, "campaign", 60)).toEqual([{ id: "camp-1", newCustomers: 2, repeatCustomers: 1 }]);

    // A 30 días, la compra en dólares (36 días después) ya no es recompra.
    expect((await reader.money(tenant, october, "ad", 30, TZ)).filter((row) => row.kind === "repeat")).toEqual([
      { id: "ad-1", kind: "repeat", day: "2026-10-20", currency: "COP", amount: 50000 }
    ]);
    expect(await reader.counts(tenant, october, "adset", 30)).toEqual([{ id: "set-1", newCustomers: 2, repeatCustomers: 1 }]);

    // Filtrar por otra campaña: nada. Y la otra cuenta tiene sus propios clientes, no los de esta.
    expect(await reader.counts(tenant, october, "campaign", 60, { campaignIds: ["otra"] })).toEqual([]);
    expect(await reader.counts(other, october, "campaign", 60)).toEqual([{ id: "camp-1", newCustomers: 2, repeatCustomers: 1 }]);
  });
});
