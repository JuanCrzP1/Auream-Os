import { describe, expect, it } from "vitest";
import { McpCredentialServices } from "../../domains/mcp/application/McpCredentialServices.js";
import { McpOAuthServices } from "../../domains/mcp/application/McpOAuthServices.js";
import { isAllowedRedirectUri, readClientRegistration, verifyPkce } from "../../domains/mcp/domain/OAuth.js";
import { InMemoryMcpCredentialRepository } from "../../infrastructure/persistence/memory/InMemoryMcpCredentialRepository.js";
import { InMemoryMcpOAuthRepository } from "../../infrastructure/persistence/memory/InMemoryMcpOAuthRepository.js";

// ---------------------------------------------------------------------------
// OAuth 2.1 del servidor MCP (lo que usa Claude web y escritorio): registro
// del agente, autorización con permisos elegidos, código de un solo uso con
// PKCE, tokens que rotan y que se cortan al revocar la credencial.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const RESOURCE = "https://auream-os.vercel.app/api/mcp";
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
// Ejemplo del RFC 7636 (apéndice B).
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

function setup() {
  const clock = { ms: Date.parse("2026-11-09T12:00:00.000Z") };
  const now = () => new Date(clock.ms);
  let n = 0;
  const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const newSecret = () => `secreto${++n}`;
  const repository = new InMemoryMcpOAuthRepository();
  const credentialRepository = new InMemoryMcpCredentialRepository(repository);
  const credentials = new McpCredentialServices({ repository: credentialRepository, newId, newSecret, now });
  const oauth = new McpOAuthServices({ repository, credentials, resourceUrl: RESOURCE, newId, newSecret, now });
  return { clock, oauth, credentials, credentialRepository, repository };
}

async function authorize(s: ReturnType<typeof setup>, permissions: Record<string, string> = { contacts: "write" }) {
  const client = (await s.oauth.register({ client_name: "Claude", redirect_uris: [CALLBACK], token_endpoint_auth_method: "none" })) as { client_id: string };
  const params = { response_type: "code", client_id: client.client_id, redirect_uri: CALLBACK, code_challenge: CHALLENGE, code_challenge_method: "S256", state: "xyz", resource: RESOURCE };
  const { redirectTo } = await s.oauth.decide(T, { params, approve: true, permissions });
  const code = new URL(redirectTo).searchParams.get("code")!;
  return { clientId: client.client_id, params, redirectTo, code };
}

describe("reglas de OAuth", () => {
  it("direcciones de regreso: https, o http solo en el propio equipo; sin fragmento", () => {
    expect([CALLBACK, "http://localhost:6274/cb", "http://127.0.0.1:9/x", "http://evil.com/cb", "https://a.com/#x", "javascript:alert(1)"].map(isAllowedRedirectUri)).toEqual([true, true, true, false, false, false]);
  });

  it("registro: exige direcciones válidas y cliente público; el nombre por defecto es «Agente MCP»", () => {
    expect(readClientRegistration({ redirect_uris: [CALLBACK] })).toEqual({ name: "Agente MCP", redirectUris: [CALLBACK] });
    expect(() => readClientRegistration({})).toThrow(/redirect_uris/);
    expect(() => readClientRegistration({ redirect_uris: ["http://evil.com/cb"] })).toThrow(/no permitida/);
    expect(() => readClientRegistration({ redirect_uris: [CALLBACK], token_endpoint_auth_method: "client_secret_basic" })).toThrow(/públicos/);
  });

  it("PKCE S256 (ejemplo del RFC 7636)", () => {
    expect(verifyPkce(VERIFIER, CHALLENGE)).toBe(true);
    expect(verifyPkce(`${VERIFIER.slice(0, -1)}x`, CHALLENGE)).toBe(false);
    expect(verifyPkce("corto", CHALLENGE)).toBe(false);
  });
});

describe("McpOAuthServices", () => {
  it("describe al agente; una dirección de regreso ajena no se usa; sin PKCE el error vuelve al agente", async () => {
    const s = setup();
    const { params } = await authorize(s);
    expect(await s.oauth.describe(params)).toEqual({ status: "ready", clientName: "Claude", redirectHost: "claude.ai" });
    expect(await s.oauth.describe({ ...params, redirect_uri: "https://evil.com/cb" })).toMatchObject({ status: "invalid", redirectTo: null });
    expect(await s.oauth.describe({ ...params, client_id: "no-existe" })).toMatchObject({ status: "invalid", message: expect.stringMatching(/no está registrado/) });
    const noPkce = await s.oauth.describe({ ...params, code_challenge_method: "plain" });
    expect(noPkce.status === "invalid" && new URL(noPkce.redirectTo!).searchParams.get("error")).toBe("invalid_request");
  });

  it("autorizar crea una credencial OAuth con los permisos elegidos y devuelve el código con el state", async () => {
    const s = setup();
    const { redirectTo } = await authorize(s, { contacts: "read", flows: "read" });
    expect(new URL(redirectTo).searchParams.get("state")).toBe("xyz");
    expect(await s.credentials.list(T)).toEqual([expect.objectContaining({ kind: "oauth", name: "Claude", hint: "", permissions: { flows: "read", contacts: "read" } })]);
  });

  it("rechazar vuelve al agente con access_denied y no crea nada", async () => {
    const s = setup();
    const { params } = await authorize(s);
    const { redirectTo } = await s.oauth.decide(T, { params, approve: false });
    expect(new URL(redirectTo).searchParams.get("error")).toBe("access_denied");
    expect(await s.credentials.list(T)).toHaveLength(1);
  });

  it("el código + PKCE da tokens; el token de acceso entra al MCP con los permisos elegidos", async () => {
    const s = setup();
    const { clientId, code } = await authorize(s);
    const tokens = await s.oauth.exchange({ grant_type: "authorization_code", code, code_verifier: VERIFIER, client_id: clientId, redirect_uri: CALLBACK, resource: RESOURCE });
    expect(tokens).toMatchObject({ token_type: "Bearer", expires_in: 3600, access_token: expect.stringMatching(/^aur_at_/), refresh_token: expect.stringMatching(/^aur_rt_/) });
    expect([...(await s.credentials.authenticate(tokens.access_token))!.scopes].sort()).toEqual(["contacts.read", "contacts.write"]);
    expect(JSON.stringify([...s.repository.tokens.values()])).not.toContain(tokens.access_token);
  });

  it("el código sirve una vez, vence a los 10 minutos y exige el verificador, el cliente y la dirección correctos", async () => {
    const base = { grant_type: "authorization_code", code_verifier: VERIFIER, redirect_uri: CALLBACK };
    const s = setup();
    const first = await authorize(s);
    await s.oauth.exchange({ ...base, code: first.code, client_id: first.clientId });
    await expect(s.oauth.exchange({ ...base, code: first.code, client_id: first.clientId })).rejects.toMatchObject({ code: "invalid_grant" });

    for (const wrong of [{ code_verifier: `${VERIFIER.slice(0, -1)}x` }, { client_id: "otro" }, { redirect_uri: "https://claude.ai/otra" }]) {
      const attempt = await authorize(s);
      await expect(s.oauth.exchange({ ...base, code: attempt.code, client_id: attempt.clientId, ...wrong })).rejects.toMatchObject({ code: "invalid_grant" });
    }
    const late = await authorize(s);
    s.clock.ms += 10 * 60_000 + 1;
    await expect(s.oauth.exchange({ ...base, code: late.code, client_id: late.clientId })).rejects.toMatchObject({ code: "invalid_grant" });
    await expect(s.oauth.exchange({ grant_type: "password" })).rejects.toMatchObject({ code: "unsupported_grant_type" });
    await expect(s.oauth.exchange({ ...base, code: "x", resource: "https://otro.com/mcp" })).rejects.toMatchObject({ code: "invalid_target" });
  });

  it("el acceso vence a la hora; la renovación rota (la vieja ya no sirve) y revocar la credencial lo corta todo", async () => {
    const s = setup();
    const { clientId, code } = await authorize(s);
    const first = await s.oauth.exchange({ grant_type: "authorization_code", code, code_verifier: VERIFIER, client_id: clientId, redirect_uri: CALLBACK });
    s.clock.ms += 60 * 60_000;
    expect(await s.credentials.authenticate(first.access_token)).toBeNull();

    const second = await s.oauth.exchange({ grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: clientId });
    expect(await s.credentials.authenticate(second.access_token)).not.toBeNull();
    await expect(s.oauth.exchange({ grant_type: "refresh_token", refresh_token: first.refresh_token })).rejects.toMatchObject({ code: "invalid_grant" });

    const [credential] = await s.credentials.list(T);
    await s.credentials.revoke(T, credential!.id);
    expect(await s.credentials.authenticate(second.access_token)).toBeNull();
    await expect(s.oauth.exchange({ grant_type: "refresh_token", refresh_token: second.refresh_token })).rejects.toMatchObject({ code: "invalid_grant" });
  });

  it("volver a autorizar el mismo agente reemplaza su credencial anterior (y sus tokens)", async () => {
    const s = setup();
    const first = await authorize(s);
    const tokens = await s.oauth.exchange({ grant_type: "authorization_code", code: first.code, code_verifier: VERIFIER, client_id: first.clientId, redirect_uri: CALLBACK });
    await s.oauth.decide(T, { params: first.params, approve: true, permissions: { flows: "read" } });
    expect((await s.credentials.list(T)).map((credential) => credential.permissions)).toEqual([{ flows: "read" }]);
    expect(await s.credentials.authenticate(tokens.access_token)).toBeNull();
  });

  it("autorizar exige al menos un área y una solicitud válida", async () => {
    const s = setup();
    const { params } = await authorize(s);
    await expect(s.oauth.decide(T, { params, approve: true, permissions: {} })).rejects.toThrow(/al menos a un área/);
    await expect(s.oauth.decide(T, { params: { ...params, client_id: "no-existe" }, approve: true, permissions: { flows: "read" } })).rejects.toThrow(/no está registrado/);
  });
});
