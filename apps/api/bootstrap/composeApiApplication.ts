import { loadApiConfig, type ApiConfig } from "../config/loadApiConfig";
import { loadDatabaseConfig } from "../config/loadDatabaseConfig";
import { loadNeonAuthConfig } from "../config/loadNeonAuthConfig";
import { composeAuthService } from "../composition/composeAuthService";
import { composeBuilderServices } from "../composition/composeBuilderServices";
import { composeTenancyServices } from "../composition/composeTenancyServices";
import { composeContactsServices } from "../composition/composeContactsServices";
import { composeIntegrationsServices } from "../composition/composeIntegrationsServices";
import { composeConnectionsServices } from "../composition/composeConnectionsServices";
import { composeMediaServices } from "../composition/composeMediaServices";
import { StructuredLogger } from "../../../platform/observability/logging/StructuredLogger";
import { RequestLogger } from "../../../platform/observability/logging/RequestLogger";
import { ErrorLogger } from "../../../platform/observability/logging/ErrorLogger";
import { createApiRequestListener, type ApiRequestListener } from "./createApiServer";

// ---------------------------------------------------------------------------
// composeApiApplication — lee la configuración del entorno y compone TODA la
// API una vez por proceso. La usan `main.ts` (servidor que escucha un puerto)
// y la función de Vercel (`api/index.ts`): una sola composición, dos formas
// de servirla.
//
// Lanza `ApiConfigError` si falta algo obligatorio: quien llama decide cómo
// fallar (salir del proceso, o responder 500 sin filtrar detalles).
// ---------------------------------------------------------------------------

export interface ApiApplication {
  readonly config: ApiConfig;
  readonly listener: ApiRequestListener;
}

export function composeApiApplication(env: NodeJS.ProcessEnv = process.env): ApiApplication {
  const config = loadApiConfig(env);
  const databaseConfig = loadDatabaseConfig(env);
  const authConfig = loadNeonAuthConfig(env);

  const logger = new StructuredLogger({ service: "bots-ai-platform-api" });
  const tenancy = composeTenancyServices(databaseConfig);
  const integrations = composeIntegrationsServices(tenancy.sqlClient, config.credentialsKeyRing, undefined, { metaGraphVersion: config.metaGraphVersion });

  const listener = createApiRequestListener(config, {
    services: composeBuilderServices(config, tenancy.sqlClient, integrations.aiGateway, integrations.conversionTracker),
    contactsServices: composeContactsServices(tenancy.sqlClient),
    integrationsServices: integrations,
    connectionsServices: composeConnectionsServices(tenancy.sqlClient),
    mediaServices: composeMediaServices(config, tenancy.sqlClient),
    meServices: {
      membershipRepository: tenancy.membershipRepository,
      onboarding: tenancy.onboarding
    },
    authService: composeAuthService(config, authConfig),
    requestLogger: new RequestLogger(logger),
    errorLogger: new ErrorLogger(logger)
  });

  return { config, listener };
}
