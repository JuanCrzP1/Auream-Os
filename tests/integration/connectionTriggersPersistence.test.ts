import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlConnectionRepository } from "../../infrastructure/persistence/sql/SqlConnectionRepository.js";
import { SqlConnectionTriggerRepository } from "../../infrastructure/persistence/sql/SqlConnectionTriggerRepository.js";
import { SqlFlowCatalog } from "../../infrastructure/persistence/sql/SqlFlowCatalog.js";
import { CreateConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { ConnectionTriggerServices } from "../../domains/connections/application/ConnectionTriggerServices.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Disparadores en PostgreSQL (rama `test`): ligados a su conexión y a su flujo
// (se borran con ellos) y un solo genérico de cada tipo por número.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function insertTenant(key: string): Promise<string> {
  const result = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [TEST_KEY_PREFIX + key, key]);
  return result.rows[0]!.id;
}

async function insertFlow(tenantId: string, name: string, status = "active"): Promise<string> {
  const id = randomUUID();
  await sql.query("insert into automations (id, tenant_id, key, name, status) values ($1, $2, $5, $3, $4)", [id, tenantId, name, status, id]);
  return id;
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

describe("SqlConnectionTriggerRepository", () => {
  it("guarda, resuelve y se borra con su flujo y con su conexión", async () => {
    const tenant = await insertTenant("tr-a");
    const ventas = await insertFlow(tenant, "Ventas");
    const soporte = await insertFlow(tenant, "Soporte");
    const connections = new SqlConnectionRepository(sql);
    const services = new ConnectionTriggerServices(connections, new SqlConnectionTriggerRepository(sql), new SqlFlowCatalog(sql));
    const connection = await new CreateConnectionService(connections).execute(tenant, { name: "Ventas CO", method: "qr" });

    await services.create(tenant, connection.id, { type: "keyword", keywords: ["precio", "cuánto cuesta"], match: "contains", automationId: ventas });
    await services.create(tenant, connection.id, { type: "any_message", automationId: soporte });
    const list = await services.list(tenant, connection.id);
    expect(list.map((t) => [t.type, t.automationName, t.keywords])).toEqual([["keyword", "Ventas", ["precio", "cuánto cuesta"]], ["any_message", "Soporte", []]]);
    expect(await services.resolve(tenant, connection.id, { text: "¿Cuánto cuesta?", isNewContact: false, fromAd: false })).toMatchObject({ automationId: ventas });

    await sql.query("delete from automations where id = $1", [soporte]);
    expect(await services.list(tenant, connection.id)).toHaveLength(1);
    await connections.delete(tenant, connection.id);
    const left = await sql.query("select count(*)::int as n from connection_triggers where tenant_id = $1", [tenant]);
    expect(left.rows[0]).toEqual({ n: 0 });
  });

  it("la base impide dos «cualquier mensaje» en el mismo número", async () => {
    const tenant = await insertTenant("tr-b");
    const flow = await insertFlow(tenant, "Ventas");
    const connections = new SqlConnectionRepository(sql);
    const repository = new SqlConnectionTriggerRepository(sql);
    const connection = await new CreateConnectionService(connections).execute(tenant, { name: "Ventas CO", method: "qr" });
    const base = { tenantId: tenant, connectionId: connection.id, automationId: flow, type: "any_message" as const, keywords: [], match: "contains" as const, enabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await repository.save({ ...base, id: randomUUID() });
    await expect(repository.save({ ...base, id: randomUUID() })).rejects.toThrow(/ya tiene un disparador/);
  });
});
