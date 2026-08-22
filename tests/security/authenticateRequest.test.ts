import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { authenticateRequest } from "../../apps/api/middleware/authenticateRequest.js";
import { composeAuthService } from "../../apps/api/composition/composeAuthService.js";
import { loadApiConfig } from "../../apps/api/config/loadApiConfig.js";

// ---------------------------------------------------------------------------
// Protege exactamente el defecto investigado: una API sin credencial DEV
// registrada debe rechazar con 401 en el nivel de autenticación (antes de
// tenancy), y una API con DEV_API_KEY configurada debe autenticar con el
// mismo valor que usaría el frontend vía VITE_DEV_API_KEY.
//
// Usa composeAuthService real (el mismo que ensambla apps/api/main.ts), no un
// doble de prueba: así valida la cadena completa env → config → registro.
// ---------------------------------------------------------------------------

function fakeRequest(headers: Record<string, string>): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

const VALID_SECRET = "x".repeat(32);

describe("authenticateRequest — credencial DEV", () => {
  it("sin DEV_API_KEY configurada, una peticion sin cabeceras no autentica", async () => {
    const config = loadApiConfig({ JWT_SECRET: VALID_SECRET });
    const authService = composeAuthService(config);

    const context = await authenticateRequest(fakeRequest({}), authService);

    expect(context).toBeNull();
  });

  it("con DEV_API_KEY configurada, X-Api-Key con ese mismo valor autentica", async () => {
    const config = loadApiConfig({ JWT_SECRET: VALID_SECRET, DEV_API_KEY: "bfk_dev_test0000" });
    const authService = composeAuthService(config);

    const context = await authenticateRequest(
      fakeRequest({ "x-api-key": "bfk_dev_test0000" }),
      authService
    );

    expect(context).not.toBeNull();
    expect(context?.tenantId).toBe(config.devTenantId);
  });

  it("una X-Api-Key que no coincide con DEV_API_KEY sigue sin autenticar", async () => {
    const config = loadApiConfig({ JWT_SECRET: VALID_SECRET, DEV_API_KEY: "bfk_dev_test0000" });
    const authService = composeAuthService(config);

    const context = await authenticateRequest(
      fakeRequest({ "x-api-key": "bfk_dev_otro-valor" }),
      authService
    );

    expect(context).toBeNull();
  });
});
