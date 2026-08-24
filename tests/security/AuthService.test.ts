import { describe, it, expect } from "vitest";
import { AuthService } from "../../platform/identity/application/AuthService.js";
import { ApiKeyVerifier } from "../../platform/identity/application/ApiKeyVerifier.js";
import { InMemoryApiKeyRegistry } from "../../infrastructure/persistence/memory/InMemoryApiKeyRegistry.js";
import type { TokenVerifier } from "../../platform/identity/application/TokenVerifier.js";
import type { UserIdentity } from "../../platform/identity/contracts/UserIdentity.js";

// ---------------------------------------------------------------------------
// AuthService devuelve dos formas distintas a propósito:
//   Bearer  → UserIdentity  (sólo quién eres)
//   API key → AuthIdentity  (quién, en qué tenant, con qué scopes)
// ---------------------------------------------------------------------------

const RAW_API_KEY = "bfk_service_key_000000000000000000000000000000000000";

function buildAuthService(verifier: TokenVerifier): AuthService {
  const registry = new InMemoryApiKeyRegistry();
  registry.register(RAW_API_KEY, {
    tenantId: "tenant-a",
    actorId: "machine-1",
    scopes: ["flows.read"]
  });

  return new AuthService(verifier, new ApiKeyVerifier(registry));
}

const stubVerifier: TokenVerifier = {
  verify: async (token: string): Promise<UserIdentity> => {
    if (token !== "token-valido") {
      throw new Error("Firma inválida");
    }
    return { actorId: "user-123" };
  }
};

describe("AuthService", () => {
  it("authenticateBearer devuelve SOLO la identidad del usuario", async () => {
    const identity = await buildAuthService(stubVerifier).authenticateBearer("token-valido");

    expect(identity).toEqual({ actorId: "user-123" });
    expect(identity).not.toHaveProperty("tenantId");
    expect(identity).not.toHaveProperty("scopes");
  });

  it("authenticateBearer propaga el fallo de verificación", async () => {
    await expect(
      buildAuthService(stubVerifier).authenticateBearer("token-invalido")
    ).rejects.toThrow();
  });

  it("authenticateApiKey devuelve tenant y scopes de la credencial de máquina", async () => {
    const identity = await buildAuthService(stubVerifier).authenticateApiKey(RAW_API_KEY);

    expect(identity.tenantId).toBe("tenant-a");
    expect(identity.actorId).toBe("machine-1");
    expect(identity.scopes).toEqual(["flows.read"]);
  });

  it("rechaza una API key no registrada", async () => {
    await expect(
      buildAuthService(stubVerifier).authenticateApiKey("bfk_no_registrada_0000000000000000")
    ).rejects.toThrow();
  });
});
