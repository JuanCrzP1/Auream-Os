import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { authenticateRequest } from "../../apps/api/middleware/authenticateRequest.js";
import { composeAuthService } from "../../apps/api/composition/composeAuthService.js";
import { loadApiConfig } from "../../apps/api/config/loadApiConfig.js";
import type { NeonAuthConfig } from "../../apps/api/config/loadNeonAuthConfig.js";

// ---------------------------------------------------------------------------
// Protege el camino de credencial de máquina (API key) de extremo a extremo,
// usando la composición real que ensambla apps/api/main.ts.
//
// El camino de usuario (Bearer/JWKS) se prueba en jwtCrossBranch.test.ts, que
// no necesita red porque usa fixtures grabadas.
// ---------------------------------------------------------------------------

const AUTH_CONFIG: NeonAuthConfig = {
  baseUrl: "https://auth.example.test/neondb/auth",
  issuer: "https://auth.example.test",
  audience: "https://auth.example.test",
  jwksUrl: "https://auth.example.test/neondb/auth/.well-known/jwks.json"
};

function fakeRequest(headers: Record<string, string>): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

describe("authenticateRequest — credencial de máquina", () => {
  it("sin DEV_API_KEY configurada, una peticion sin cabeceras no autentica", async () => {
    const authService = composeAuthService(loadApiConfig({}), AUTH_CONFIG);

    expect(await authenticateRequest(fakeRequest({}), authService)).toBeNull();
  });

  it("con DEV_API_KEY configurada, X-Api-Key con ese mismo valor autentica como máquina", async () => {
    const config = loadApiConfig({ DEV_API_KEY: "bfk_dev_test0000" });
    const authService = composeAuthService(config, AUTH_CONFIG);

    const principal = await authenticateRequest(
      fakeRequest({ "x-api-key": "bfk_dev_test0000" }),
      authService
    );

    expect(principal?.kind).toBe("machine");
    expect(principal?.identity.actorId).toBe("dev-user");
  });

  it("una X-Api-Key que no coincide con DEV_API_KEY sigue sin autenticar", async () => {
    const config = loadApiConfig({ DEV_API_KEY: "bfk_dev_test0000" });
    const authService = composeAuthService(config, AUTH_CONFIG);

    const principal = await authenticateRequest(
      fakeRequest({ "x-api-key": "bfk_dev_otro-valor" }),
      authService
    );

    expect(principal).toBeNull();
  });

  it("un Bearer con firma no verificable no autentica", async () => {
    const authService = composeAuthService(loadApiConfig({}), AUTH_CONFIG);

    const principal = await authenticateRequest(
      fakeRequest({ authorization: "Bearer no.es.un-token" }),
      authService
    );

    expect(principal).toBeNull();
  });
});
