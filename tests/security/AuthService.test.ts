import { describe, it, expect, beforeEach } from "vitest";
import { JwtTokenVerifier } from "../../platform/identity/application/JwtTokenVerifier.js";
import { ApiKeyVerifier } from "../../platform/identity/application/ApiKeyVerifier.js";
import { AuthService } from "../../platform/identity/application/AuthService.js";
import { InMemoryApiKeyRegistry } from "../../infrastructure/persistence/memory/InMemoryApiKeyRegistry.js";
import { TEST_SECRET, signJwt, makeValidPayload } from "./helpers/jwt.js";

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

describe("AuthService", () => {
  let authService: AuthService;
  let registry: InMemoryApiKeyRegistry;

  beforeEach(() => {
    registry = new InMemoryApiKeyRegistry();
    authService = new AuthService(
      new JwtTokenVerifier(TEST_SECRET),
      new ApiKeyVerifier(registry)
    );
  });

  it("authenticateBearer construye RequestContext con método jwt", async () => {
    const token = signJwt(makeValidPayload());
    const context = await authService.authenticateBearer(token);

    expect(context.authMethod).toBe("jwt");
    expect(context.tenantId).toBe("test-tenant");
    expect(context.actorId).toBe("actor-123");
    expect(context.requestId).toBeTruthy();
    expect(context.scopes).toContain("builder:read");
  });

  it("authenticateApiKey construye RequestContext con método api_key", async () => {
    const rawKey = "bfk_service_key_000000000000000000000000000000000000";
    registry.register(rawKey, {
      tenantId: "test-tenant",
      actorId: "service-account-2",
      scopes: ["builder:read"]
    });

    const context = await authService.authenticateApiKey(rawKey);

    expect(context.authMethod).toBe("api_key");
    expect(context.tenantId).toBe("test-tenant");
    expect(context.requestId).toBeTruthy();
  });

  it("cada request autenticada recibe un requestId único", async () => {
    const token = signJwt(makeValidPayload());
    const ctx1 = await authService.authenticateBearer(token);
    const ctx2 = await authService.authenticateBearer(token);

    expect(ctx1.requestId).not.toBe(ctx2.requestId);
  });

  it("rechaza un Bearer token inválido", async () => {
    await expect(authService.authenticateBearer("token.malformado")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// InMemorySessionRepository — tenant isolation
// ---------------------------------------------------------------------------
