import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlConnectionRepository } from "../../infrastructure/persistence/sql/SqlConnectionRepository.js";
import { CreateConnectionService, ListConnectionsService, RenameConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Conexiones de WhatsApp en PostgreSQL (rama `test`): por cuenta, con nombres
// únicos y los estados y teléfonos que permite la tabla.
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

describe("SqlConnectionRepository", () => {
  it("guarda por cuenta, con nombres únicos sin importar mayúsculas", async () => {
    const a = await insertTenant("wa-a");
    const b = await insertTenant("wa-b");
    const repository = new SqlConnectionRepository(sql);
    const create = new CreateConnectionService(repository);

    const ventas = await create.execute(a, { name: "Ventas", method: "qr" });
    await create.execute(a, { name: "Oficial", method: "cloud_api" });
    await expect(create.execute(a, { name: "VENTAS", method: "qr" })).rejects.toThrow(ConflictError);
    await create.execute(b, { name: "Ventas", method: "qr" });

    const list = await new ListConnectionsService(repository).execute(a);
    expect(list.map((c) => [c.name, c.method, c.status])).toEqual([["Ventas", "qr", "pending"], ["Oficial", "cloud_api", "pending"]]);
    expect((await new RenameConnectionService(repository).execute(a, ventas.id, { name: "Ventas CO" })).name).toBe("Ventas CO");
  });

  it("guarda el número vinculado y rechaza teléfonos inválidos", async () => {
    const a = await insertTenant("wa-c");
    const repository = new SqlConnectionRepository(sql);
    const created = await new CreateConnectionService(repository).execute(a, { name: "Ventas", method: "qr" });
    const stored = (await repository.findById(a, created.id))!;
    const at = new Date().toISOString();
    await repository.save({ ...stored, status: "connected", phoneNumber: "573013815302", profileName: "Auream", providerRef: "s1", lastConnectedAt: at, updatedAt: at });
    expect(await repository.findById(a, created.id)).toMatchObject({ status: "connected", phoneNumber: "573013815302", providerRef: "s1" });
    await expect(repository.save({ ...stored, phoneNumber: "abc" })).rejects.toThrow();
  });
});
