import { AuthService } from "../../../platform/identity/application/AuthService";
import { JwtTokenVerifier } from "../../../platform/identity/application/JwtTokenVerifier";
import { ApiKeyVerifier } from "../../../platform/identity/application/ApiKeyVerifier";
import { InMemoryApiKeyRegistry } from "../../../infrastructure/persistence/memory/InMemoryApiKeyRegistry";
import type { ApiConfig } from "../config/loadApiConfig";

// ---------------------------------------------------------------------------
// composeAuthService
//
// Responsabilidad única: ensamblar el servicio de autenticación.
//
// La credencial de desarrollo NO está hardcodeada y sólo se registra cuando
// `DEV_API_KEY` viene del entorno. `loadApiConfig` garantiza que ese valor sea
// null en producción, así que este registro nunca ocurre en un despliegue real.
// ---------------------------------------------------------------------------

const DEV_SCOPES = ["flows.read", "flows.write", "flows.publish", "runtime.execute"];

export function composeAuthService(config: ApiConfig): AuthService {
  const apiKeyRegistry = new InMemoryApiKeyRegistry();

  if (config.devApiKey) {
    apiKeyRegistry.register(config.devApiKey, {
      tenantId: config.devTenantId,
      actorId: "dev-user",
      scopes: DEV_SCOPES
    });
  }

  return new AuthService(
    new JwtTokenVerifier(config.jwtSecret),
    new ApiKeyVerifier(apiKeyRegistry)
  );
}
