import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlPixelConnectionRepository } from "../../infrastructure/persistence/sql/SqlPixelConnectionRepository.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { CreatePixelConnectionService, ListPixelConnectionsService } from "../../domains/integrations/application/PixelConnectionServices.js";
import { PixelConnectionVault } from "../../domains/integrations/application/PixelConnectionVault.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Píxeles de Meta en PostgreSQL (rama `test`): token cifrado, por cuenta y
// con nombres únicos.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
const access = { verifyPixel: async () => ({ ok: true as const }) };
const TOKEN = "EAAOtokenDePruebaMuyLargo0123456789ZDZD";

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

describe("SqlPixelConnectionRepository", () => {
  it("token cifrado en la base, solo legible en su cuenta; nombres únicos por cuenta", async () => {
    const a = await insertTenant("px-a");
    const b = await insertTenant("px-b");
    const repo = new SqlPixelConnectionRepository(sql);
    const created = await new CreatePixelConnectionService(repo, cipher, access).execute(a, { name: "Ventas", pixelId: "3151000009796", accessToken: TOKEN });

    const raw = await sql.query<{ secret: string }>("select secret from pixel_connections where id = $1", [created.id]);
    expect(raw.rows[0]!.secret).not.toContain(TOKEN);
    expect(await new PixelConnectionVault(repo, cipher).reveal(a, created.id)).toMatchObject({ pixelId: "3151000009796", accessToken: TOKEN });
    expect(await new ListPixelConnectionsService(repo).execute(b)).toEqual([]);
    // Otro píxel con el mismo nombre (sin importar mayúsculas): lo frena el índice único de la base.
    await expect(new CreatePixelConnectionService(repo, cipher, access).execute(a, { name: "VENTAS", pixelId: "3151000009797", accessToken: TOKEN })).rejects.toBeInstanceOf(ConflictError);
  });

  it("la base rechaza un ID de píxel que no es numérico", async () => {
    const tenant = await insertTenant("px-c");
    await expect(
      sql.query("insert into pixel_connections (id, tenant_id, name, pixel_id, secret, token_hint) values (gen_random_uuid(), $1, 'x', 'abc', 'v1.a.b.c', 'h')", [tenant])
    ).rejects.toThrow();
  });
});
