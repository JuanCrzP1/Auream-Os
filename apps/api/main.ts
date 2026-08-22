import { loadApiConfig, ApiConfigError } from "./config/loadApiConfig";
import { composeAuthService } from "./composition/composeAuthService";
import { composeBuilderServices } from "./composition/composeBuilderServices";
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

  try {
    config = loadApiConfig();
  } catch (error) {
    if (error instanceof ApiConfigError) {
      console.error(`[FATAL] ${error.message}`);
      process.exit(1);
    }

    throw error;
  }

  const logger = new StructuredLogger({ service: "bots-ai-platform-api" });

  const server = createApiServer(config, {
    services: composeBuilderServices(config),
    authService: composeAuthService(config),
    requestLogger: new RequestLogger(logger),
    errorLogger: new ErrorLogger(logger)
  });

  server.listen(config.port, () => {
    console.log(`API escuchando en http://localhost:${config.port}`);
  });
}

start();
