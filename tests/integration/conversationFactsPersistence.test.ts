import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlConversationFacts } from "../../infrastructure/persistence/sql/SqlConversationFacts.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// `{attendant_name}`, `{instance_name}` y `{instance_number}` en PostgreSQL
// (rama `test`): el asesor de la conversación y el número por el que entró,
// leídos de la clave «<conexión>:<teléfono>»; solo de la propia cuenta.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + key, key]);
  return result.rows[0]!.id;
}

async function insertConnection(tenant: string, name: string, phone: string): Promise<string> {
  const result = await sql.query<{ id: string }>(
    "insert into whatsapp_connections (id, tenant_id, name, method, phone_number) values ($1, $2, $3, 'qr', $4) returning id",
    [randomUUID(), tenant, name, phone]
  );
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

describe("SqlConversationFacts", () => {
  it("quién atiende y por qué número; sin asesor, solo el número; otra cuenta, nada", async () => {
    const tenant = await insertTenant("facts-a");
    const other = await insertTenant("facts-b");
    const connection = await insertConnection(tenant, "Ventas", "573001112233");
    const advisor = randomUUID();
    await sql.query("insert into user_profiles (user_id, display_name, email) values ($1, 'Camilo', 'camilo@ejemplo.com')", [advisor]);
    await sql.query("insert into conversations (id, tenant_id, connection_id, phone, assignee_id) values ($4, $1, $2, '584121110011', $3)", [tenant, connection, advisor, randomUUID()]);
    const facts = new SqlConversationFacts(sql);

    expect(await facts.facts(tenant, `${connection}:584121110011`)).toEqual({ assigneeName: "Camilo", connectionName: "Ventas", connectionNumber: "573001112233" });
    expect(await facts.facts(tenant, `${connection}:584129999999`)).toEqual({ assigneeName: null, connectionName: "Ventas", connectionNumber: "573001112233" });
    expect(await facts.facts(other, `${connection}:584121110011`)).toBeNull();
    expect(await facts.facts(tenant, "sin-conexion")).toBeNull();
    await sql.query("delete from user_profiles where user_id = $1", [advisor]);
  });
});
