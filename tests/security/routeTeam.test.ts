import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeTeamRequest } from "../../apps/api/routes/routeTeamRequest.js";
import { routeInvitationPublic } from "../../apps/api/routes/routeInvitationPublic.js";
import { routeMeRequest } from "../../apps/api/routes/routeMeRequest.js";
import type { TeamServices } from "../../domains/team/application/TeamServices.js";
import type { InvitationServices } from "../../domains/team/application/InvitationServices.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { JwksTokenVerifier } from "../../platform/identity/application/JwksTokenVerifier.js";
import { TEST_ISSUER, sharedKeyStore } from "../fixtures/identity/jwksFixtures.js";
import { mintToken } from "../fixtures/identity/mintToken.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// Equipo por HTTP: ver exige `team.read`; invitar, cambiar y quitar exigen
// `team.manage`; nunca con credenciales de máquina; la cuenta y el usuario
// salen del contexto. El enlace se abre sin sesión y se acepta con sesión,
// con el correo que firmó Neon Auth (nunca el que mande el cliente).
// ---------------------------------------------------------------------------

const MEMBER = "aaaaaaaa-0000-4000-8000-000000000003";
const INVITATION = "bbbbbbbb-0000-4000-8000-000000000001";
const TOKEN = "t".repeat(43);

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {}, socket: { remoteAddress: "1.2.3.4" } }) as unknown as IncomingMessage;
const res = () => {
  const r = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { r.body = chunk ?? ""; } };
  return r;
};

const teamServices = () => ({
  list: vi.fn(async () => ({ members: [], invitations: [], myRole: "tenant_owner", assignableRoles: [] })),
  invite: vi.fn(async () => ({ invitation: { id: INVITATION }, token: TOKEN })),
  renew: vi.fn(async () => ({ invitation: { id: INVITATION }, token: TOKEN })),
  revoke: vi.fn(async () => undefined),
  changeRole: vi.fn(async () => ({ members: [] })),
  remove: vi.fn(async () => undefined)
});

async function run(s: ReturnType<typeof teamServices>, method: string, path: string, scopes: string[], body?: unknown, authMethod: "jwt" | "api_key" = "jwt") {
  const response = res();
  const handled = await routeTeamRequest(req(method, path, body), response as never, new URL(`http://x${path}`), s as unknown as TeamServices, makeContext({ scopes, authMethod, tenantId: "tenant-a", actorId: "user-a" }));
  return { handled, status: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
}

describe("routeTeamRequest", () => {
  it("todo el equipo ve el equipo de SU cuenta; sin team.read no", async () => {
    const s = teamServices();
    expect((await run(s, "GET", "/team", ["team.read"])).status).toBe(200);
    expect(s.list).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-a" });
    await expect(run(s, "GET", "/team", ["flows.read"])).rejects.toBeInstanceOf(AccessError);
  });

  it("invitar, renovar, cancelar, cambiar rol y quitar exigen team.manage", async () => {
    const s = teamServices();
    expect((await run(s, "POST", "/team/invitations", ["team.read", "team.manage"], { email: "a@x.co", role: "operator" })).status).toBe(201);
    expect((await run(s, "POST", `/team/invitations/${INVITATION}/renew`, ["team.manage"])).status).toBe(200);
    expect((await run(s, "DELETE", `/team/invitations/${INVITATION}`, ["team.manage"])).status).toBe(204);
    expect((await run(s, "PATCH", `/team/members/${MEMBER}`, ["team.manage"], { role: "viewer" })).status).toBe(200);
    expect((await run(s, "DELETE", `/team/members/${MEMBER}`, ["team.manage"])).status).toBe(204);
    expect(s.changeRole).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-a" }, MEMBER, { role: "viewer" });

    await expect(run(s, "POST", "/team/invitations", ["team.read"], { email: "a@x.co", role: "operator" })).rejects.toBeInstanceOf(AccessError);
    await expect(run(s, "DELETE", `/team/members/${MEMBER}`, ["team.read"])).rejects.toBeInstanceOf(AccessError);
  });

  it("una credencial de máquina no administra equipos; otras rutas no son suyas", async () => {
    const s = teamServices();
    expect((await run(s, "GET", "/team", ["team.read", "team.manage"], undefined, "api_key")).status).toBe(403);
    expect(s.list).not.toHaveBeenCalled();
    expect((await run(s, "GET", "/teams", ["team.read"])).handled).toBe(false);
  });
});

describe("enlace de invitación", () => {
  const invitations = () => ({
    preview: vi.fn(async () => ({ status: "pending" })),
    accept: vi.fn(async () => ({ tenantId: "tenant-a", tenantName: "Dilo", role: "operator", joined: true }))
  });

  it("se abre sin sesión, con límite por IP", async () => {
    const s = invitations();
    const limiter = { check: vi.fn(async () => ({ allowed: true, remaining: 1, retryAfterMs: 0 })) };
    const response = res();
    const handled = await routeInvitationPublic(req("GET", `/invitations/${TOKEN}`), response as never, new URL(`http://x/invitations/${TOKEN}`), s as unknown as InvitationServices, limiter as never);
    expect(handled).toBe(true);
    expect(s.preview).toHaveBeenCalledWith(TOKEN);
    expect(limiter.check).toHaveBeenCalledWith(expect.stringContaining("invite:preview:"), expect.anything());
  });

  it("se acepta con sesión y con el correo del token firmado, no con el que mande el cliente", async () => {
    const s = invitations();
    const verifier = new JwksTokenVerifier({ keyStore: sharedKeyStore(), expectedIssuer: TEST_ISSUER, expectedAudience: TEST_ISSUER });
    const identity = await verifier.verify(mintToken({ iss: TEST_ISSUER, sub: "user-b", extraClaims: { email: "  Maria@X.co", emailVerified: true } }));
    expect(identity).toEqual({ actorId: "user-b", email: "maria@x.co", emailVerified: true });

    const path = `/me/invitations/${TOKEN}/accept`;
    const handled = await routeMeRequest(req("POST", path, { email: "otro@x.co" }), res() as never, new URL(`http://x${path}`), { invitations: s } as never, { kind: "user", identity });
    expect(handled).toBe(true);
    expect(s.accept).toHaveBeenCalledWith(TOKEN, { userId: "user-b", email: "maria@x.co" });
  });
});
