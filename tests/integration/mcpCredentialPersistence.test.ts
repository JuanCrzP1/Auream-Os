import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import type { SqlClient } from "../../infrastructure/persistence/sql/SqlClient.js";
import { SqlMcpCredentialRepository } from "../../infrastructure/persistence/sql/SqlMcpCredentialRepository.js";
import { SqlMcpOAuthRepository } from "../../infrastructure/persistence/sql/SqlMcpOAuthRepository.js";
import { McpCredentialServices } from "../../domains/mcp/application/McpCredentialServices.js";
import { McpOAuthServices } from "../../domains/mcp/application/McpOAuthServices.js";
import { cleanupTestData, createTestSqlClient, TEST_KEY_PREFIX } from "./setup/testDatabase.js";

// Credenciales MCP en PostgreSQL (`025_mcp_credentials.sql`, `026_mcp_oauth.sql`):
// solo la huella del token, autenticación por huella, último uso, revocación
// por cuenta; y OAuth: código de un solo uso, tokens que rotan, todo se borra
// con la credencial.

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

  it("OAuth: registro, autorización, código de un solo uso, rotación y borrado en cascada", async () => {
    const tenant = (await sql.query<{ id: string }>("insert into tenants (key, name) values ($1, $2) returning id", [`${TEST_KEY_PREFIX}mcp-oauth`, "mcp-oauth"])).rows[0]!.id;
    const newSecret = () => randomBytes(32).toString("base64url");
    const credentials = new McpCredentialServices({ repository: new SqlMcpCredentialRepository(sql), newId: randomUUID, newSecret });
    const resourceUrl = "https://auream-os.vercel.app/api/mcp";
    const oauth = new McpOAuthServices({ repository: new SqlMcpOAuthRepository(sql), credentials, resourceUrl, newId: randomUUID, newSecret });
    const callback = "https://claude.ai/api/mcp/auth_callback";
    const { client_id: clientId } = (await oauth.register({ client_name: "Claude", redirect_uris: [callback] })) as { client_id: string };
    const params = { response_type: "code", client_id: clientId, redirect_uri: callback, code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", code_challenge_method: "S256", resource: resourceUrl };
    const { redirectTo } = await oauth.decide(tenant, { params, approve: true, permissions: { flows: "read" } });
    const code = new URL(redirectTo).searchParams.get("code")!;
    const exchange = { grant_type: "authorization_code", code, code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", client_id: clientId, redirect_uri: callback };

    const first = await oauth.exchange(exchange);
    await expect(oauth.exchange(exchange)).rejects.toMatchObject({ code: "invalid_grant" });
    expect((await credentials.authenticate(first.access_token))?.tenantId).toBe(tenant);

    const second = await oauth.exchange({ grant_type: "refresh_token", refresh_token: first.refresh_token });
    expect(await credentials.authenticate(first.access_token)).toBeNull();
    expect([...((await credentials.authenticate(second.access_token))?.scopes ?? [])]).toEqual(["flows.read"]);

    const [credential] = await credentials.list(tenant);
    expect(credential).toMatchObject({ kind: "oauth", name: "Claude" });
    await credentials.revoke(tenant, credential!.id);
    expect((await sql.query("select 1 from mcp_oauth_tokens where credential_id = $1", [credential!.id])).rowCount).toBe(0);
    await sql.query("delete from mcp_oauth_clients where client_id = $1", [clientId]);
  });
});
