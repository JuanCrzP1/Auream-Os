import type { IncomingMessage, ServerResponse } from "node:http";
import { ApiConfigError } from "../apps/api/config/loadApiConfig";
import { composeApiApplication, type ApiApplication } from "../apps/api/bootstrap/composeApiApplication";

// ---------------------------------------------------------------------------
// Función de Vercel: TODA la API detrás de `/api/*`, en el mismo dominio que
// la web (sin CORS entre ellas).
//
// `vercel.json` reescribe `/api/<ruta>` a esta función conservando la URL; aquí
// se quita el prefijo `/api` y la petición sigue por el MISMO listener que usa
// el servidor local. La aplicación se compone una vez por instancia (arranque
// en frío) y se reutiliza mientras la instancia viva.
//
// Si falta configuración, responde 500 sin detalles y lo deja en el registro
// de la función (los mensajes de configuración nunca contienen secretos).
// ---------------------------------------------------------------------------

let app: ApiApplication | null = null;

/** `/api/automations?x=1` → `/automations?x=1`; `/api` → `/`. */
export function stripApiPrefix(url: string): string {
  const stripped = url.replace(/^\/api(?=\/|\?|$)/, "");
  return stripped === "" || stripped.startsWith("?") ? `/${stripped}` : stripped;
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!app) {
    try {
      app = composeApiApplication();
    } catch (error) {
      console.error(`[FATAL] ${error instanceof ApiConfigError ? error.message : String(error)}`);
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ message: "La API no está configurada correctamente." }));
      return;
    }
  }

  request.url = stripApiPrefix(request.url ?? "/");
  await app.listener(request, response);
}
