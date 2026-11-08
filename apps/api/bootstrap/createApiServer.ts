import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { applyCorsHeaders } from "../middleware/applyCorsHeaders";
import { routeApiRequest, type ApiRouterDependencies } from "../routes/routeApiRequest";
import { sendJson } from "../http/sendJson";
import { toErrorResponse } from "../http/toErrorResponse";
import { TooManyRequestsError } from "../../../platform/observability/errors/TooManyRequestsError";
import type { ApiConfig } from "../config/loadApiConfig";
import type { ErrorLogger } from "../../../platform/observability/logging/ErrorLogger";

// ---------------------------------------------------------------------------
// createApiRequestListener / createApiServer
//
// El listener es la API entera: CORS → routing → manejo de errores, para UNA
// petición. No compone dependencias ni lee entorno, y no sabe dónde corre:
//
//   · local / servidor propio   createApiServer (node:http escuchando un puerto)
//   · Vercel                    la función `api/index.ts` llama al listener
// ---------------------------------------------------------------------------

export interface ApiServerDependencies extends ApiRouterDependencies {
  readonly errorLogger: ErrorLogger;
}

export type ApiRequestListener = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

export function createApiRequestListener(config: ApiConfig, dependencies: ApiServerDependencies): ApiRequestListener {
  return async (request, response) => {
    applyCorsHeaders(request, response, config.allowedOrigins);

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");

    try {
      await routeApiRequest(request, response, url, dependencies);
    } catch (error) {
      dependencies.errorLogger.log(error instanceof Error ? error : new Error(String(error)), {});

      const { statusCode, message } = toErrorResponse(error);
      if (error instanceof TooManyRequestsError) {
        response.setHeader("Retry-After", String(Math.max(1, Math.ceil(error.retryAfterMs / 1000))));
      }
      sendJson(response, statusCode, { message });
    }
  };
}

export function createApiServer(config: ApiConfig, dependencies: ApiServerDependencies): Server {
  const listener = createApiRequestListener(config, dependencies);
  return createServer((request, response) => void listener(request, response));
}
