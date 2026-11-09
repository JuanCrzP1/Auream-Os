import { describe, expect, it } from "vitest";
import { routeOAuthPublic } from "../../apps/api/routes/routeOAuthPublic.js";
import { routeOAuthConsentRequest } from "../../apps/api/routes/routeOAuthConsentRequest.js";
import { routeMcp } from "../../apps/api/routes/routeMcp.js";
import type { RequestContext } from "../../platform/identity/contracts/RequestContext.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import { TooManyRequestsError } from "../../platform/observability/errors/TooManyRequestsError.js";
import { callRoute, createMcpServer, type HttpCall } from "./helpers/mcpServer.js";

// ---------------------------------------------------------------------------
// Claude (web o escritorio) conectándose como lo hace de verdad: recibe 401,
// lee los metadatos, se registra, el usuario autoriza en Auream (con sesión y
// permiso de credenciales), cambia el código por tokens (formulario) y llama
// al MCP con el token de acceso. Sin sesión ni permiso no se autoriza nada.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const owner: RequestContext = { tenantId: T, actorId: "u1", authMethod: "jwt", requestId: "r1", scopes: ["credentials.write"] };

function setup() {
  const { server } = createMcpServer();
  const limiter = new InMemoryRateLimiter();
  return {
    server,
    agent: (call: HttpCall) => callRoute((request, response, url) => routeOAuthPublic(request, response, url, server, limiter), call),
    user: (call: HttpCall, context = owner) => callRoute((request, response, url) => routeOAuthConsentRequest(request, response, url, server, context), call),
    mcp: (token: string) =>
      callRoute((request, response, url) => routeMcp(request, response, url, server, limiter), { path: "/mcp", body: { jsonrpc: "2.0", id: 1, method: "tools/list" }, headers: { authorization: `Bearer ${token}` } })
  };
}

describe("OAuth del servidor MCP", () => {
  it("descubrimiento: recurso protegido y servidor de autorización, con las direcciones públicas", async () => {
    const s = setup();
    const resource = await s.agent({ method: "GET", path: "/.well-known/oauth-protected-resource/api/mcp" });
    expect(resource.json).toMatchObject({ resource: "https://auream-os.vercel.app/api/mcp", authorization_servers: ["https://auream-os.vercel.app"] });
    const metadata = (await s.agent({ method: "GET", path: "/.well-known/oauth-authorization-server" })).json;
    expect(metadata).toMatchObject({
      issuer: "https://auream-os.vercel.app",
      authorization_endpoint: "https://auream-os.vercel.app/oauth/authorize",
      token_endpoint: "https://auream-os.vercel.app/api/oauth/token",
      registration_endpoint: "https://auream-os.vercel.app/api/oauth/register",
      code_challenge_methods_supported: ["S256"]
    });
    expect((await s.agent({ path: "/.well-known/oauth-authorization-server" })).status).toBe(405);
  });

  it("de punta a punta: registro, autorización del usuario, tokens por formulario y llamada al MCP", async () => {
    const s = setup();
    const registered = await s.agent({ path: "/oauth/register", body: { client_name: "Claude", redirect_uris: [CALLBACK], token_endpoint_auth_method: "none" } });
    expect([registered.status, registered.headers["cache-control"]]).toEqual([201, "no-store"]);
    const clientId: string = registered.json.client_id;

    const query = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: CALLBACK, code_challenge: CHALLENGE, code_challenge_method: "S256", state: "abc" });
    expect((await s.user({ method: "GET", path: `/oauth/authorize/request?${query}` })).json).toEqual({ status: "ready", clientName: "Claude", redirectHost: "claude.ai" });
    const decision = await s.user({ path: "/oauth/authorize/decision", body: { params: Object.fromEntries(query), approve: true, permissions: { contacts: "read" } } });
    const back = new URL(decision.json.redirectTo);
    expect([back.origin + back.pathname, back.searchParams.get("state")]).toEqual([CALLBACK, "abc"]);

    const form = new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code")!, code_verifier: VERIFIER, client_id: clientId, redirect_uri: CALLBACK }).toString();
    const tokens = await s.agent({ path: "/oauth/token", body: form });
    expect([tokens.status, tokens.headers["cache-control"], tokens.json.token_type]).toEqual([200, "no-store", "Bearer"]);

    const listed = await s.mcp(tokens.json.access_token);
    expect(listed.json.result.tools.map((tool: { name: string }) => tool.name)).toEqual(["list_contacts", "get_contact", "list_labels"]);

    const reused = await s.agent({ path: "/oauth/token", body: form });
    expect([reused.status, reused.json.error]).toEqual([400, "invalid_grant"]);
  });

  it("errores con el formato de OAuth: registro inválido, cuerpo roto", async () => {
    const s = setup();
    const bad = await s.agent({ path: "/oauth/register", body: { redirect_uris: ["http://evil.com/cb"] } });
    expect([bad.status, bad.json.error]).toEqual([400, "invalid_redirect_uri"]);
    const broken = await s.agent({ path: "/oauth/token", body: "{roto" });
    expect([broken.status, broken.json.error]).toEqual([400, "invalid_request"]);
  });

  it("sin permiso de credenciales no se autoriza; el registro tiene límite por IP", async () => {
    const s = setup();
    const advisor = { ...owner, scopes: ["conversations.read"] };
    await expect(s.user({ method: "GET", path: "/oauth/authorize/request?client_id=x" }, advisor)).rejects.toThrow();
    for (let i = 0; i < 30; i += 1) await s.agent({ path: "/oauth/register", body: { redirect_uris: [CALLBACK] } });
    await expect(s.agent({ path: "/oauth/register", body: { redirect_uris: [CALLBACK] } })).rejects.toBeInstanceOf(TooManyRequestsError);
  });
});
