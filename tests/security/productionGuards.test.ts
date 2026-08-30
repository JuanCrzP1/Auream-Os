import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateRequest } from "../../apps/api/middleware/authenticateRequest.js";
import { composeAuthService } from "../../apps/api/composition/composeAuthService.js";
import { loadApiConfig, ApiConfigError } from "../../apps/api/config/loadApiConfig.js";
import { routeMeRequest } from "../../apps/api/routes/routeMeRequest.js";
import type { NeonAuthConfig } from "../../apps/api/config/loadNeonAuthConfig.js";
import type { MembershipRepository } from "../../domains/team/application/MembershipRepository.js";
import type { OnboardingPort } from "../../domains/team/application/OnboardingPort.js";

// ---------------------------------------------------------------------------
// Garantías que separan desarrollo de producción.
//
// La credencial de máquina de desarrollo (`DEV_API_KEY`) es el único atajo de
// autenticación del sistema. Aquí se demuestra, con la composición real que
// usa `apps/api/main.ts`, que en producción no existe ninguna forma de
// activarla: ni configurándola (el arranque falla), ni omitiendo el guard.
// ---------------------------------------------------------------------------

const AUTH_CONFIG: NeonAuthConfig = {
  baseUrl: "https://auth.example.test/neondb/auth",
  issuer: "https://auth.example.test",
  audience: "https://auth.example.test",
  jwksUrl: "https://auth.example.test/neondb/auth/.well-known/jwks.json"
};

const PRODUCTION_ENV = {
  NODE_ENV: "production",
  CORS_ALLOWED_ORIGINS: "https://app.example.com"
};

function fakeRequest(headers: Record<string, string>, method = "GET"): IncomingMessage {
  return { headers, method } as unknown as IncomingMessage;
}

describe("la API key de desarrollo no puede usarse en producción", () => {
  it("el proceso se niega a arrancar si DEV_API_KEY está definida en producción", () => {
    expect(() =>
      loadApiConfig({ ...PRODUCTION_ENV, DEV_API_KEY: "bfk_dev_clave-real" })
    ).toThrow(ApiConfigError);
  });

  it("en producción no se registra ninguna credencial de máquina, así que X-Api-Key no autentica", async () => {
    // Configuración de producción válida: sin DEV_API_KEY el arranque sí procede.
    const authService = composeAuthService(loadApiConfig(PRODUCTION_ENV), AUTH_CONFIG);

    // Valores de forma variada, ninguno real: lo que se comprueba es que en
    // producción el registro de claves está vacío, así que da igual cuál se
    // presente.
    const attempts = [
      "bfk_dev_0000000000000000",
      "bfk_cualquier-cosa",
      "sin-prefijo",
      ""
    ];

    for (const key of attempts) {
      expect(await authenticateRequest(fakeRequest({ "x-api-key": key }), authService)).toBeNull();
    }
  });

  it("la misma clave que autentica en desarrollo es rechazada en producción", async () => {
    const key = "bfk_dev_test0000";

    const devService = composeAuthService(loadApiConfig({ DEV_API_KEY: key }), AUTH_CONFIG);
    const prodService = composeAuthService(loadApiConfig(PRODUCTION_ENV), AUTH_CONFIG);

    expect(await authenticateRequest(fakeRequest({ "x-api-key": key }), devService)).not.toBeNull();
    expect(await authenticateRequest(fakeRequest({ "x-api-key": key }), prodService)).toBeNull();
  });

  it("producción exige allowlist de CORS: no hay caída a orígenes de desarrollo", () => {
    expect(() => loadApiConfig({ NODE_ENV: "production" })).toThrow(/CORS_ALLOWED_ORIGINS/);

    const config = loadApiConfig(PRODUCTION_ENV);
    expect(config.allowedOrigins).toEqual(["https://app.example.com"]);
    expect(config.allowedOrigins).not.toContain("http://localhost:5173");
  });

  it("el origen canónico de desarrollo es sólo localhost, nunca 127.0.0.1", () => {
    // Neon Auth rechaza 127.0.0.1 con INVALID_ORIGIN. Si la API lo aceptara,
    // la aplicación cargaría pero el login fallaría sin explicación.
    expect(loadApiConfig({}).allowedOrigins).toEqual(["http://localhost:5173"]);
  });
});

describe("las rutas /me/* son exclusivas de usuarios humanos", () => {
  const membershipRepository: MembershipRepository = {
    async findActive() {
      return null;
    },
    async findActiveByUser() {
      return [];
    }
  };

  function services(onboarding: OnboardingPort) {
    return { membershipRepository, onboarding };
  }

  function fakeResponse(): ServerResponse {
    return {
      setHeader: vi.fn(),
      end: vi.fn(),
      statusCode: 200
    } as unknown as ServerResponse;
  }

  it("una credencial de máquina no puede crear un tenant por /me/onboarding", async () => {
    const ensureInitialTenant = vi.fn();
    const onboarding = { ensureInitialTenant } as unknown as OnboardingPort;

    const handled = await routeMeRequest(
      fakeRequest({}, "POST"),
      fakeResponse(),
      new URL("http://localhost/me/onboarding"),
      services(onboarding),
      { kind: "machine", identity: { tenantId: "t-1", actorId: "worker-1", scopes: [] } }
    );

    expect(handled).toBe(false);
    // Lo decisivo: no se llegó a crear ningún tenant para la máquina.
    expect(ensureInitialTenant).not.toHaveBeenCalled();
  });

  it("una credencial de máquina no puede listar memberships por /me/tenants", async () => {
    const findActiveByUser = vi.fn().mockResolvedValue([]);

    const handled = await routeMeRequest(
      fakeRequest({}),
      fakeResponse(),
      new URL("http://localhost/me/tenants"),
      {
        membershipRepository: { findActive: async () => null, findActiveByUser },
        onboarding: {} as OnboardingPort
      },
      { kind: "machine", identity: { tenantId: "t-1", actorId: "worker-1", scopes: [] } }
    );

    expect(handled).toBe(false);
    expect(findActiveByUser).not.toHaveBeenCalled();
  });

  it("un usuario sí puede completar su alta inicial", async () => {
    const ensureInitialTenant = vi.fn().mockResolvedValue({
      tenantId: "t-1",
      tenantKey: "mi-espacio",
      tenantName: "Mi espacio",
      membership: { userId: "user-1", tenantId: "t-1", role: "tenant_owner", status: "active" },
      created: true
    });
    const onboarding = { ensureInitialTenant } as unknown as OnboardingPort;

    const handled = await routeMeRequest(
      fakeRequest({}, "POST"),
      fakeResponse(),
      new URL("http://localhost/me/onboarding"),
      services(onboarding),
      { kind: "user", identity: { actorId: "user-1" } }
    );

    expect(handled).toBe(true);
    expect(ensureInitialTenant).toHaveBeenCalledWith("user-1", "Mi espacio");
  });
});
