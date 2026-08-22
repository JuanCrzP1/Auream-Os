import { describe, it, expect, beforeEach } from "vitest";
import { JwtTokenVerifier } from "../../platform/identity/application/JwtTokenVerifier.js";
import { TEST_SECRET, signJwt, makeValidPayload } from "./helpers/jwt.js";

// ---------------------------------------------------------------------------
// JwtTokenVerifier
// ---------------------------------------------------------------------------

describe("JwtTokenVerifier", () => {
  let verifier: JwtTokenVerifier;

  beforeEach(() => {
    verifier = new JwtTokenVerifier(TEST_SECRET);
  });

  it("verifica un JWT válido y devuelve la identidad correcta", async () => {
    const token = signJwt(makeValidPayload());
    const identity = await verifier.verify(token);

    expect(identity.tenantId).toBe("test-tenant");
    expect(identity.actorId).toBe("actor-123");
    expect(identity.scopes).toContain("builder:read");
  });

  it("rechaza un JWT con firma inválida", async () => {
    const token = signJwt(makeValidPayload(), "wrong-secret-also-at-least-32-chars!!");
    await expect(verifier.verify(token)).rejects.toThrow("Invalid JWT signature");
  });

  it("rechaza un JWT expirado", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(makeValidPayload({ exp: now - 1 }));
    await expect(verifier.verify(token)).rejects.toThrow("JWT expired");
  });

  it("rechaza un JWT sin claim tenant", async () => {
    const payload = makeValidPayload();
    const { tenant: _tenant, ...withoutTenant } = payload as Record<string, unknown>;
    const token = signJwt(withoutTenant);
    await expect(verifier.verify(token)).rejects.toThrow("JWT missing tenant claim");
  });

  it("rechaza un JWT sin claim sub", async () => {
    const payload = makeValidPayload();
    const { sub: _sub, ...withoutSub } = payload as Record<string, unknown>;
    const token = signJwt(withoutSub);
    await expect(verifier.verify(token)).rejects.toThrow("JWT missing subject claim");
  });

  it("rechaza un JWT sin claim scopes", async () => {
    const payload = makeValidPayload();
    const { scopes: _scopes, ...withoutScopes } = payload as Record<string, unknown>;
    const token = signJwt(withoutScopes);
    await expect(verifier.verify(token)).rejects.toThrow("JWT missing scopes claim");
  });

  it("rechaza un JWT con iat en el futuro", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt(makeValidPayload({ iat: now + 300 }));
    await expect(verifier.verify(token)).rejects.toThrow("JWT iat claim is in the future");
  });

  it("rechaza un token sin la estructura JWT (sin puntos)", async () => {
    await expect(verifier.verify("notajwt")).rejects.toThrow("Invalid JWT structure");
  });

  it("rechaza un token con payload base64 corrompido", async () => {
    const parts = signJwt(makeValidPayload()).split(".");
    const corruptedToken = `${parts[0]}.!!invalid!!.${parts[2]}`;
    await expect(verifier.verify(corruptedToken)).rejects.toThrow();
  });

  it("lanza si el secreto tiene menos de 32 caracteres", () => {
    expect(() => new JwtTokenVerifier("short")).toThrow("JWT secret must be at least 32 characters");
  });
});

// ---------------------------------------------------------------------------
// ApiKeyVerifier + InMemoryApiKeyRegistry
// ---------------------------------------------------------------------------
