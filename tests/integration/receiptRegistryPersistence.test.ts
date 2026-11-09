import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlReceiptRegistry } from "../../infrastructure/persistence/sql/SqlReceiptRegistry.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Comprobantes aceptados en PostgreSQL (rama `test`): un comprobante se
// reclama una sola vez por cuenta, aunque lleguen dos a la vez.
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

describe("SqlReceiptRegistry", () => {
  const receipt = { fingerprint: "ref:M8743219", reference: "M8743219", amount: 149900, currency: "COP", conversationKey: "c1", flowKey: "f1" };

  it("reclama una vez por cuenta; otra cuenta puede tener la misma referencia", async () => {
    const a = await insertTenant("pp-a");
    const b = await insertTenant("pp-b");
    const registry = new SqlReceiptRegistry(sql);

    expect(await registry.exists(a, receipt.fingerprint)).toBe(false);
    expect(await registry.claim(a, receipt)).toBe("new");
    expect(await registry.claim(a, { ...receipt, conversationKey: "otra" })).toBe("duplicate");
    expect(await registry.exists(a, receipt.fingerprint)).toBe(true);
    expect(await registry.claim(b, receipt)).toBe("new");

    const rows = await sql.query<{ amount: string; currency: string }>("select amount, currency from payment_proof_receipts where tenant_id = $1", [a]);
    expect(rows.rows).toEqual([{ amount: "149900.00", currency: "COP" }]);
  });

  it("dos mensajes con el mismo comprobante a la vez: solo uno lo reclama", async () => {
    const a = await insertTenant("pp-race");
    const registry = new SqlReceiptRegistry(sql);
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => registry.claim(a, receipt)));
    expect(outcomes.filter((outcome) => outcome === "new")).toHaveLength(1);
  });
});
