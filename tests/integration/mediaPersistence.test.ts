import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlMediaRepository } from "../../infrastructure/persistence/sql/SqlMediaRepository.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Medios en PostgreSQL (rama `test`): por cuenta, idempotente, y la base
// rechaza una ruta fuera de la carpeta de su cuenta.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const ID = "55555555-5555-4555-8555-555555555555";

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

describe("SqlMediaRepository", () => {
  it("guarda, lee solo en su cuenta y registrar dos veces no duplica", async () => {
    const tenant = await insertTenant("media-a");
    const other = await insertTenant("media-b");
    const repo = new SqlMediaRepository(sql);
    const asset = { id: ID, tenantId: tenant, kind: "image" as const, pathname: `tenants/${tenant}/media/${ID}/a.png`, url: "https://blob.test/a.png", contentType: "image/png", size: 1234, fileName: "a.png", createdAt: new Date().toISOString() };

    await repo.save(asset);
    await repo.save(asset);
    expect(await repo.findById(tenant, ID)).toMatchObject({ url: "https://blob.test/a.png", size: 1234 });
    expect(await repo.findById(other, ID)).toBeNull();
    expect((await sql.query<{ n: number }>("select count(*)::int n from media_assets where id = $1", [ID])).rows[0]!.n).toBe(1);
  });

  it("la base rechaza una ruta de otra cuenta", async () => {
    const tenant = await insertTenant("media-c");
    const other = await insertTenant("media-d");
    await expect(
      new SqlMediaRepository(sql).save({ id: ID, tenantId: tenant, kind: "image", pathname: `tenants/${other}/media/${ID}/a.png`, url: "u", contentType: "image/png", size: 1, fileName: "a", createdAt: new Date().toISOString() })
    ).rejects.toThrow();
  });
});
