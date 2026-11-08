import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlAiCredentialRepository } from "../../infrastructure/persistence/sql/SqlAiCredentialRepository.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { CreateAiCredentialService, DeleteAiCredentialService, ListAiCredentialsService, UpdateAiCredentialService } from "../../domains/integrations/application/AiCredentialServices.js";
import { AiCredentialVault } from "../../domains/integrations/application/AiCredentialVault.js";
import type { AiProviderAccess } from "../../domains/integrations/application/ports/AiProviderAccess.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// ---------------------------------------------------------------------------
// Conexiones de IA en PostgreSQL (rama `test` de Neon): la clave queda
// cifrada en la base, solo se descifra en su cuenta y los nombres son únicos.
// ---------------------------------------------------------------------------

let sql: SqlClient;
const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
const access: AiProviderAccess = {
  verifyKey: async () => ({ ok: true }),
  listModels: async () => ({ ok: true, models: [] })
};
const KEY = "sk-test-clave-real-0123456789wxyz";

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

describe("SqlAiCredentialRepository", () => {
  it("guarda la clave cifrada (nunca en claro) y la vuelve a leer en su cuenta", async () => {
    const tenant = await insertTenant("ai-a");
    const repo = new SqlAiCredentialRepository(sql);
    const created = await new CreateAiCredentialService(repo, cipher, access).execute(tenant, { provider: "openai", name: "Principal", apiKey: KEY });

    const raw = await sql.query<{ secret: string; secret_hint: string }>("select secret, secret_hint from ai_credentials where id = $1", [created.id]);
    expect(raw.rows[0]!.secret).not.toContain(KEY);
    expect(raw.rows[0]!.secret_hint).toBe("••••wxyz");
    expect(await new AiCredentialVault(repo, cipher).reveal(tenant, created.id)).toEqual({ provider: "openai", apiKey: KEY, status: "active" });
    expect((await new ListAiCredentialsService(repo).execute(tenant)).map((c) => c.name)).toEqual(["Principal"]);
  });

  it("otra cuenta no la ve ni la descifra; nombres únicos por cuenta", async () => {
    const a = await insertTenant("ai-b1");
    const b = await insertTenant("ai-b2");
    const repo = new SqlAiCredentialRepository(sql);
    const created = await new CreateAiCredentialService(repo, cipher, access).execute(a, { provider: "gemini", name: "Gemini", apiKey: KEY });

    expect(await new ListAiCredentialsService(repo).execute(b)).toEqual([]);
    expect(await new AiCredentialVault(repo, cipher).reveal(b, created.id)).toBeNull();
    await expect(new CreateAiCredentialService(repo, cipher, access).execute(a, { provider: "openai", name: "GEMINI", apiKey: KEY })).rejects.toBeInstanceOf(ConflictError);
    await expect(new CreateAiCredentialService(repo, cipher, access).execute(b, { provider: "openai", name: "Gemini", apiKey: KEY })).resolves.toBeTruthy();
  });

  it("actualizar y borrar; la base rechaza un secreto que no es un sobre", async () => {
    const tenant = await insertTenant("ai-c");
    const repo = new SqlAiCredentialRepository(sql);
    const created = await new CreateAiCredentialService(repo, cipher, access).execute(tenant, { provider: "openrouter", name: "OR", apiKey: KEY });

    expect((await new UpdateAiCredentialService(repo, cipher, access).execute(tenant, created.id, { name: "OpenRouter" })).name).toBe("OpenRouter");
    await expect(
      sql.query("update ai_credentials set secret = $2 where id = $1", [created.id, "sk-en-claro con espacios"])
    ).rejects.toThrow();
    await new DeleteAiCredentialService(repo).execute(tenant, created.id);
    expect(await repo.findById(tenant, created.id)).toBeNull();
  });
});
