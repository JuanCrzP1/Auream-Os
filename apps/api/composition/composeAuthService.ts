import { AuthService } from "../../../platform/identity/application/AuthService";
import { JwksTokenVerifier } from "../../../platform/identity/application/JwksTokenVerifier";
import { ApiKeyVerifier } from "../../../platform/identity/application/ApiKeyVerifier";
import { HttpJwksKeyStore } from "../../../infrastructure/identity/HttpJwksKeyStore";
import { InMemoryApiKeyRegistry } from "../../../infrastructure/persistence/memory/InMemoryApiKeyRegistry";
import type { ApiConfig } from "../config/loadApiConfig";
import type { NeonAuthConfig } from "../config/loadNeonAuthConfig";

// ---------------------------------------------------------------------------
// composeAuthService
//
// Responsabilidad única: ensamblar el servicio de autenticación.
//
// El verificador se configura con el issuer y la audiencia de UN solo entorno:
// el proceso que sirve producción no puede aceptar tokens de test, ni al revés.
//
// La credencial de desarrollo (máquina) sólo se registra si `DEV_API_KEY` viene
// del entorno; `loadApiConfig` garantiza que sea null en producción.
// ---------------------------------------------------------------------------

const DEV_SCOPES = ["flows.read", "flows.write", "flows.publish", "runtime.execute"];

export function composeAuthService(config: ApiConfig, authConfig: NeonAuthConfig): AuthService {
  const apiKeyRegistry = new InMemoryApiKeyRegistry();

  if (config.devApiKey) {
    apiKeyRegistry.register(config.devApiKey, {
      tenantId: config.devTenantId,
      actorId: "dev-user",
      scopes: DEV_SCOPES
    });
  }

  const tokenVerifier = new JwksTokenVerifier({
    keyStore: new HttpJwksKeyStore(authConfig.jwksUrl),
    expectedIssuer: authConfig.issuer,
    expectedAudience: authConfig.audience
  });

  return new AuthService(tokenVerifier, new ApiKeyVerifier(apiKeyRegistry));
}
