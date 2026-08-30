import { loadEnvFile } from "./config/loadEnvFile";
import { loadApiConfig, ApiConfigError } from "./config/loadApiConfig";
import { loadDatabaseConfig } from "./config/loadDatabaseConfig";
import { loadNeonAuthConfig } from "./config/loadNeonAuthConfig";
import { composeAuthService } from "./composition/composeAuthService";
import { composeBuilderServices } from "./composition/composeBuilderServices";
import { composeTenancyServices } from "./composition/composeTenancyServices";
import { createApiServer } from "./bootstrap/createApiServer";
import { StructuredLogger } from "../../platform/observability/logging/StructuredLogger";
import { RequestLogger } from "../../platform/observability/logging/RequestLogger";
import { ErrorLogger } from "../../platform/observability/logging/ErrorLogger";

// ---------------------------------------------------------------------------
// Entrypoint de la API.
//
// Responsabilidad única: cargar configuración, componer dependencias y
// escuchar. Toda la lógica vive en config/, composition/, routes/ y bootstrap/.
// ---------------------------------------------------------------------------

function start(): void {
  let config;
  let databaseConfig;
  let authConfig;

  try {
    loadEnvFile();
    config = loadApiConfig();
    databaseConfig = loadDatabaseConfig();
    authConfig = loadNeonAuthConfig();
  } catch (error) {
    if (error instanceof ApiConfigError) {
      console.error(`[FATAL] ${error.message}`);
      process.exit(1);
    }

    throw error;
  }

  const logger = new StructuredLogger({ service: "bots-ai-platform-api" });
  const tenancy = composeTenancyServices(databaseConfig);

  const server = createApiServer(config, {
    services: composeBuilderServices(config),
    meServices: {
      membershipRepository: tenancy.membershipRepository,
      onboarding: tenancy.onboarding
    },
    authService: composeAuthService(config, authConfig),
    requestLogger: new RequestLogger(logger),
    errorLogger: new ErrorLogger(logger)
  });

  server.listen(config.port, () => {
    console.log(`API escuchando en http://localhost:${config.port}`);
  });
}

start();
