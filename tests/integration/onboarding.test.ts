import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlMembershipRepository } from "../../infrastructure/persistence/sql/SqlMembershipRepository.js";
import { SqlOnboardingRepository } from "../../infrastructure/persistence/sql/SqlOnboardingRepository.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Alta inicial: tenant + membership como una sola operación atómica.
//
// Se prueba contra PostgreSQL real porque lo que se verifica es precisamente
// la transacción y la idempotencia, que un doble en memoria no reproduce.
// ---------------------------------------------------------------------------

let sql: SqlClient;

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

/** Los tenants creados por onboarding llevan su propia key; se limpian aparte. */
async function dropTenant(tenantId: string): Promise<void> {
  await sql.query("delete from tenants where id = $1", [tenantId]);
}

describe("onboarding transaccional", () => {
  it("crea tenant y membership juntos, con rol de propietario", async () => {
    const userId = randomUUID();
    const result = await new SqlOnboardingRepository(sql).ensureInitialTenant(userId, "Nuevo");

    expect(result.created).toBe(true);
    expect(result.membership.role).toBe("tenant_owner");

    const membership = await new SqlMembershipRepository(sql).findActive(userId, result.tenantId);
    expect(membership).not.toBeNull();

    await dropTenant(result.tenantId);
  });

  it("es idempotente: repetirlo no crea un segundo tenant", async () => {
    const userId = randomUUID();
    const onboarding = new SqlOnboardingRepository(sql);

    const first = await onboarding.ensureInitialTenant(userId, "Primero");
    const second = await onboarding.ensureInitialTenant(userId, "Segundo");

    expect(second.created).toBe(false);
    expect(second.tenantId).toBe(first.tenantId);

    await dropTenant(first.tenantId);
  });

  it("una transacción fallida no deja estado parcial", async () => {
    const before = await sql.query<{ n: string }>("select count(*)::text as n from tenants");

    await expect(
      sql.transaction(async (tx) => {
        await tx.query("insert into tenants (key, name) values ($1, $2)", [
          TEST_KEY_PREFIX + "rollback",
          "Rollback"
        ]);
        throw new Error("fallo deliberado a mitad de la transaccion");
      })
    ).rejects.toThrow(/fallo deliberado/);

    const after = await sql.query<{ n: string }>("select count(*)::text as n from tenants");
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
  });

  it("dos peticiones concurrentes del mismo usuario nuevo no producen error ni tenants duplicados", async () => {
    const userId = randomUUID();
    // Cada llamada usa su propia conexión (como dos requests HTTP reales
    // servidas por procesos/conexiones distintas del pool en producción).
    const clientA = createTestSqlClient();
    const clientB = createTestSqlClient();

    try {
      const [resultA, resultB] = await Promise.all([
        new SqlOnboardingRepository(clientA).ensureInitialTenant(userId, "Carrera A"),
        new SqlOnboardingRepository(clientB).ensureInitialTenant(userId, "Carrera B")
      ]);

      // Exactamente una de las dos debe haber creado el tenant; ninguna debe
      // haber fallado con un error de base de datos sin capturar.
      expect([resultA.created, resultB.created].filter(Boolean)).toHaveLength(1);
      expect(resultA.tenantId).toBe(resultB.tenantId);

      const rows = await sql.query<{ n: string }>(
        "select count(*)::text as n from tenants where id = $1",
        [resultA.tenantId]
      );
      expect(rows.rows[0]!.n).toBe("1");

      const memberships = await sql.query<{ n: string }>(
        "select count(*)::text as n from memberships where user_id = $1",
        [userId]
      );
      expect(memberships.rows[0]!.n).toBe("1");

      await dropTenant(resultA.tenantId);
    } finally {
      await clientA.close();
      await clientB.close();
    }
  });
});
