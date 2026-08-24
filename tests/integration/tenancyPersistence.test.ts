import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlMembershipRepository } from "../../infrastructure/persistence/sql/SqlMembershipRepository.js";
import { SqlOnboardingRepository } from "../../infrastructure/persistence/sql/SqlOnboardingRepository.js";
import { SqlTenantRepository } from "../../infrastructure/persistence/sql/SqlTenantRepository.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Persistencia real contra PostgreSQL en la rama `test` de Neon.
// Verifica constraints, aislamiento y transaccionalidad de verdad.
// ---------------------------------------------------------------------------

let sql: SqlClient;

async function insertTenant(key: string, name: string): Promise<string> {
  const result = await sql.query<{ id: string }>(
    "insert into tenants (key, name) values ($1, $2) returning id",
    [TEST_KEY_PREFIX + key, name]
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

describe("tenants", () => {
  it("persiste y recupera un tenant por id y por key", async () => {
    const id = await insertTenant("alpha", "Alpha");
    const repo = new SqlTenantRepository(sql);

    const byId = await repo.findById(id);
    const byKey = await repo.findByKey(TEST_KEY_PREFIX + "alpha");

    expect(byId?.name).toBe("Alpha");
    expect(byKey?.id).toBe(id);
    expect(byId?.status).toBe("active");
  });

  it("devuelve null para un tenant inexistente", async () => {
    const repo = new SqlTenantRepository(sql);

    expect(await repo.findById(randomUUID())).toBeNull();
    expect(await repo.findByKey("no-existe")).toBeNull();
  });

  it("impide dos tenants con la misma key", async () => {
    await insertTenant("dup", "Uno");
    await expect(insertTenant("dup", "Dos")).rejects.toThrow();
  });

  it("rechaza un status fuera del dominio permitido", async () => {
    await expect(
      sql.query("insert into tenants (key, name, status) values ($1, $2, $3)", [
        TEST_KEY_PREFIX + "bad",
        "Bad",
        "inventado"
      ])
    ).rejects.toThrow();
  });
});

describe("memberships", () => {
  it("impide dos memberships del mismo usuario en el mismo tenant", async () => {
    const tenantId = await insertTenant("uniq", "Uniq");
    const userId = randomUUID();

    await sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [
      userId, tenantId, "operator"
    ]);

    await expect(
      sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [
        userId, tenantId, "viewer"
      ])
    ).rejects.toThrow();
  });

  it("rechaza una membership hacia un tenant inexistente (FK)", async () => {
    await expect(
      sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [
        randomUUID(), randomUUID(), "operator"
      ])
    ).rejects.toThrow();
  });

  it("rechaza un rol fuera del dominio permitido", async () => {
    const tenantId = await insertTenant("role", "Role");

    await expect(
      sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [
        randomUUID(), tenantId, "superusuario"
      ])
    ).rejects.toThrow();
  });

  it("borrar un tenant arrastra sus memberships (cascade)", async () => {
    const tenantId = await insertTenant("cascade", "Cascade");

    await sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [
      randomUUID(), tenantId, "operator"
    ]);
    await sql.query("delete from tenants where id = $1", [tenantId]);

    const left = await sql.query("select 1 from memberships where tenant_id = $1", [tenantId]);
    expect(left.rowCount).toBe(0);
  });

  it("una membership revocada no se considera activa", async () => {
    const tenantId = await insertTenant("revoked", "Revoked");
    const userId = randomUUID();

    await sql.query(
      "insert into memberships (user_id, tenant_id, role, status) values ($1, $2, $3, $4)",
      [userId, tenantId, "operator", "revoked"]
    );

    const repo = new SqlMembershipRepository(sql);
    expect(await repo.findActive(userId, tenantId)).toBeNull();
    expect(await repo.findActiveByUser(userId)).toHaveLength(0);
  });
});

describe("aislamiento entre tenants", () => {
  it("el usuario de un tenant no obtiene membership en otro", async () => {
    const tenantA = await insertTenant("iso-a", "A");
    const tenantB = await insertTenant("iso-b", "B");
    const userA = randomUUID();

    await sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [
      userA, tenantA, "tenant_owner"
    ]);

    const repo = new SqlMembershipRepository(sql);

    expect(await repo.findActive(userA, tenantA)).not.toBeNull();
    expect(await repo.findActive(userA, tenantB)).toBeNull();
  });

  it("un usuario puede pertenecer a varios tenants con roles distintos", async () => {
    const tenantA = await insertTenant("multi-a", "A");
    const tenantB = await insertTenant("multi-b", "B");
    const userId = randomUUID();

    await sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [
      userId, tenantA, "tenant_owner"
    ]);
    await sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [
      userId, tenantB, "viewer"
    ]);

    const found = await new SqlMembershipRepository(sql).findActiveByUser(userId);
    const roles = found.map((f) => f.membership.role).sort();

    expect(found).toHaveLength(2);
    expect(roles).toEqual(["tenant_owner", "viewer"]);
  });

  it("un tenant suspendido no otorga acceso aunque la membership siga activa", async () => {
    const tenantId = await insertTenant("suspended", "Suspended");
    const userId = randomUUID();

    await sql.query("insert into memberships (user_id, tenant_id, role) values ($1, $2, $3)", [
      userId, tenantId, "tenant_owner"
    ]);

    const repo = new SqlMembershipRepository(sql);
    expect(await repo.findActive(userId, tenantId)).not.toBeNull();

    await sql.query("update tenants set status = 'suspended' where id = $1", [tenantId]);

    expect(await repo.findActive(userId, tenantId)).toBeNull();
    expect(await repo.findActiveByUser(userId)).toHaveLength(0);
  });
});
