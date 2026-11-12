import type { IncomingMessage, ServerResponse } from "node:http";

// ---------------------------------------------------------------------------
// applyCorsHeaders
//
// Responsabilidad única: aplicar CORS por lista blanca.
//
// Nunca se emite `Access-Control-Allow-Origin: *`. Sólo se refleja el origen
// de la petición cuando está explícitamente permitido.
// ---------------------------------------------------------------------------

// `X-Tenant-Id` viaja en toda petición del builder desde que existe la
// tenencia: es la SELECCIÓN de tenant que el servidor valida contra la sesión.
// Sin declararla aquí, el navegador bloquea la petición entera antes de
// enviarla —el preflight no la autoriza— y el cliente recibe un `TypeError`
// indistinguible de estar sin red. Es lo que dejó al builder sin guardar nada
// desde que se añadió la cabecera.
const ALLOWED_HEADERS = "Content-Type, Authorization, X-Api-Key, X-Tenant-Id";
const ALLOWED_METHODS = "GET,PUT,POST,PATCH,DELETE,OPTIONS";
// Lo que la web puede leer de una descarga (el nombre del archivo y cuántas filas trae).
const EXPOSED_HEADERS = "Content-Disposition, X-Export-Rows, X-Export-Truncated";

export function applyCorsHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: readonly string[]
): void {
  const origin = request.headers["origin"];

  // `Vary: Origin` evita que un proxy cachee la respuesta de un origen
  // permitido y se la sirva a otro que no lo está.
  response.setHeader("Vary", "Origin");

  if (typeof origin === "string" && allowedOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    response.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
    response.setHeader("Access-Control-Expose-Headers", EXPOSED_HEADERS);
  }
}
