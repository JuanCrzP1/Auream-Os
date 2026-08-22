import { createServer, type Server } from "node:http";
import { applyCorsHeaders } from "../middleware/applyCorsHeaders";
import { routeApiRequest, type ApiRouterDependencies } from "../routes/routeApiRequest";
import { sendJson } from "../http/sendJson";
import { toErrorResponse } from "../http/toErrorResponse";
import type { ApiConfig } from "../config/loadApiConfig";
import type { ErrorLogger } from "../../../platform/observability/logging/ErrorLogger";

// ---------------------------------------------------------------------------
// createApiServer
//
// Responsabilidad única: construir el servidor HTTP y encadenar CORS →
// routing → manejo de errores. No compone dependencias ni lee entorno.
// ---------------------------------------------------------------------------

export interface ApiServerDependencies extends ApiRouterDependencies {
  readonly errorLogger: ErrorLogger;
}

export function createApiServer(config: ApiConfig, dependencies: ApiServerDependencies): Server {
  return createServer(async (request, response) => {
    applyCorsHeaders(request, response, config.allowedOrigins);

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://localhost:${config.port}`);

    try {
      await routeApiRequest(request, response, url, dependencies);
    } catch (error) {
      dependencies.errorLogger.log(
        error instanceof Error ? error : new Error(String(error)),
        {}
      );

      const { statusCode, message } = toErrorResponse(error);
      sendJson(response, statusCode, { message });
    }
  });
}
