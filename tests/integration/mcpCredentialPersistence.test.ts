import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlMcpCredentialRepository } from "../../infrastructure/persistence/sql/SqlMcpCredentialRepository.js";
import { McpCredentialServices } from "../../domains/mcp/application/McpCredentialServices.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// Credenciales MCP en PostgreSQL (`025_mcp_credentials.sql`): solo la huella del
// token, autenticación por huella, último uso, revocación por cuenta.

let sql: SqlClient;

beforeAll(() => {
  sql = createTestSqlClient();
});

afterAll(async () => {
  await cleanupTestData(sql);
  await sql.close();
});

describe("SqlMcpCredentialRepository", () => {
  it("crea, autentica por huella, anota el uso y revoca solo en su cuenta", async () => {
    const tenant = (await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [`${TEST_KEY_PREFIX}mcp`, "mcp"])).rows[0]!.id;
    const services = new McpCredentialServices({ repository: new SqlMcpCredentialRepository(sql), newId: randomUUID, newSecret: () => randomBytes(32).toString("base64url") });
    const { credential, token } = await services.create(tenant, { name: "Claude de ventas", permissions: { contacts: "write", flows: "read" }, expiresInDays: 30 });

    const stored = (await sql.query<{ token_hash: string; permissions: unknown }>("select token_hash, permissions from mcp_credentials where id = $1", [credential.id])).rows[0]!;
    expect(stored.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored.permissions).toEqual({ flows: "read", contacts: "write" });

    const access = await services.authenticate(token);
    expect([access?.tenantId, [...(access?.scopes ?? [])].sort()]).toEqual([tenant, ["contacts.read", "contacts.write", "flows.read"]]);
    expect((await services.list(tenant))[0]!.lastUsedAt).not.toBeNull();

    await expect(services.revoke(randomUUID(), credential.id)).rejects.toThrow(/no existe/);
    await services.revoke(tenant, credential.id);
    expect(await services.authenticate(token)).toBeNull();
  });
});
