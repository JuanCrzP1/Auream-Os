import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlRoundRobinCounter } from "../../infrastructure/persistence/sql/SqlRoundRobinCounter.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Turnos del Distribuidor en PostgreSQL (C10), contra la rama `test` de Neon.
// ---------------------------------------------------------------------------

let sql: SqlClient;

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

describe("SqlRoundRobinCounter", () => {
  it("devuelve 0, 1, 2… por clave", async () => {
    const tenant = await insertTenant("turnos");
    const counter = new SqlRoundRobinCounter(sql);

    expect([await counter.next(tenant, "f:d"), await counter.next(tenant, "f:d"), await counter.next(tenant, "f:d")]).toEqual([0, 1, 2]);
    expect(await counter.next(tenant, "f:otro")).toBe(0);
  });

  it("20 clientes a la vez reciben 20 turnos distintos y consecutivos (atómico)", async () => {
    const tenant = await insertTenant("concurrentes");
    const counter = new SqlRoundRobinCounter(sql);

    const turns = await Promise.all(Array.from({ length: 20 }, () => counter.next(tenant, "f:d")));

    expect([...turns].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("los turnos son por cuenta", async () => {
    const a = await insertTenant("cuenta-a");
    const b = await insertTenant("cuenta-b");
    const counter = new SqlRoundRobinCounter(sql);

    await counter.next(a, "f:d");
    await counter.next(a, "f:d");
    expect(await counter.next(b, "f:d")).toBe(0);
  });
});
