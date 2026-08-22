import { describe, it, expect, beforeEach } from "vitest";
import { ApiKeyVerifier } from "../../platform/identity/application/ApiKeyVerifier.js";
import { InMemoryApiKeyRegistry } from "../../infrastructure/persistence/memory/InMemoryApiKeyRegistry.js";

// ---------------------------------------------------------------------------
// ApiKeyVerifier + InMemoryApiKeyRegistry
// ---------------------------------------------------------------------------

describe("ApiKeyVerifier", () => {
  let registry: InMemoryApiKeyRegistry;
  let verifier: ApiKeyVerifier;

  beforeEach(() => {
    registry = new InMemoryApiKeyRegistry();
    verifier = new ApiKeyVerifier(registry);
  });

  it("verifica una API key válida y devuelve la identidad correcta", async () => {
    const rawKey = "bfk_abc123def456abc123def456abc123def456abc123def456";
    registry.register(rawKey, {
      tenantId: "test-tenant",
      actorId: "service-account-1",
      scopes: ["builder:read"]
    });

    const identity = await verifier.verify(rawKey);

    expect(identity.tenantId).toBe("test-tenant");
    expect(identity.actorId).toBe("service-account-1");
    expect(identity.scopes).toContain("builder:read");
  });

  it("rechaza una API key no registrada", async () => {
    await expect(verifier.verify("bfk_clave_inexistente_en_el_registry_seguro")).rejects.toThrow(
      "API key not found or revoked"
    );
  });

  it("rechaza una API key sin prefijo bfk_", async () => {
    await expect(verifier.verify("sk_live_alguna_clave_de_otro_formato")).rejects.toThrow(
      "Invalid API key format"
    );
  });

  it("no permite acceso cross-tenant con clave del tenant A para el tenant B", async () => {
    const keyTenantA = "bfk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    registry.register(keyTenantA, {
      tenantId: "tenant-a",
      actorId: "actor-a",
      scopes: ["builder:write"]
    });

    const identity = await verifier.verify(keyTenantA);

    // La identidad devuelta es del tenant A, nunca del tenant B
    expect(identity.tenantId).toBe("tenant-a");
    expect(identity.tenantId).not.toBe("tenant-b");
  });
});

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------
