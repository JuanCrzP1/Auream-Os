import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlUserProfileRepository } from "../../infrastructure/persistence/sql/SqlUserProfileRepository.js";
import { SqlCompanyRepository } from "../../infrastructure/persistence/sql/SqlCompanyRepository.js";
import { SqlTenantResolver } from "../../infrastructure/persistence/sql/SqlTenantResolver.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Mi perfil y Empresa contra PostgreSQL real (rama `test`, migración 028):
// el perfil se crea y se reemplaza, las restricciones frenan datos inválidos,
// la empresa cambia solo lo pedido y el motor lee su zona horaria.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const users: string[] = [];

beforeAll(() => {
  sql = createTestSqlClient();
});

beforeEach(async () => {
  await cleanupTestData(sql);
});

afterAll(async () => {
  await cleanupTestData(sql);
  if (users.length) await sql.query("delete from user_profiles where user_id = any($1::uuid[])", [users]);
  await sql.close();
});

const newUser = () => {
  const id = randomUUID();
  users.push(id);
  return id;
};

describe("user_profiles", () => {
  it("crea el perfil al primer guardado y lo reemplaza después", async () => {
    const repo = new SqlUserProfileRepository(sql);
    const userId = newUser();
    expect(await repo.find(userId)).toBeNull();

    await repo.save({ userId, displayName: "Juan Camilo", phone: "+573001234567", photoPathname: null, photoUrl: null });
    await repo.save({ userId, displayName: "Juan C. Cruz", phone: null, photoPathname: `users/${userId}/photo/a.png`, photoUrl: "https://blob.example/a.png" });

    expect(await repo.find(userId)).toEqual({ userId, displayName: "Juan C. Cruz", phone: null, photoPathname: `users/${userId}/photo/a.png`, photoUrl: "https://blob.example/a.png" });
  });

  it("la base frena teléfonos sin prefijo, nombres vacíos y fotos a medias", async () => {
    const repo = new SqlUserProfileRepository(sql);
    const base = { userId: newUser(), displayName: "Ana", phone: null, photoPathname: null, photoUrl: null };
    await expect(repo.save({ ...base, phone: "3001234567" })).rejects.toThrow();
    await expect(repo.save({ ...base, displayName: "" })).rejects.toThrow();
    await expect(repo.save({ ...base, photoPathname: "users/x/photo/a.png" })).rejects.toThrow();
  });
});

describe("empresa sobre tenants", () => {
  it("cambia solo lo pedido y el motor lee su zona horaria", async () => {
    const created = await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [`${TEST_KEY_PREFIX}empresa`, "Mi espacio"]);
    const tenantId = created.rows[0]!.id;
    const repo = new SqlCompanyRepository(sql);
    const resolver = () => new SqlTenantResolver(sql, "America/Bogota");

    expect(await repo.find(tenantId)).toEqual({ tenantId, name: "Mi espacio", timezone: null, logoPathname: null, logoUrl: null });
    expect((await resolver().resolve(tenantId)).timezone).toBe("America/Bogota");

    await repo.update(tenantId, { name: "Dilo Cantando", timezone: "America/Mexico_City" });
    const withLogo = await repo.update(tenantId, { logo: { pathname: `tenants/${tenantId}/brand/l.png`, url: "https://blob.example/l.png" } });
    expect(withLogo).toMatchObject({ name: "Dilo Cantando", timezone: "America/Mexico_City", logoUrl: "https://blob.example/l.png" });
    expect((await resolver().resolve(tenantId)).timezone).toBe("America/Mexico_City");

    expect(await repo.update(tenantId, { logo: null, timezone: null })).toMatchObject({ name: "Dilo Cantando", timezone: null, logoUrl: null });
    expect(await repo.update(randomUUID(), { name: "X" })).toBeNull();
  });
});
