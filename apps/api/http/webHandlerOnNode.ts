import type { IncomingMessage, ServerResponse } from "node:http";

// ---------------------------------------------------------------------------
// Corre un manejador web estándar (`Request` → `Response`) como función de
// Node `(req, res)`, SIN las ayudas de Vercel.
//
// El proyecto tiene `NODEJS_HELPERS=0` (la API lee el cuerpo de las peticiones
// ella misma) y eso vale para TODAS las funciones: no hay `req.body` ni
// `res.status()`. Las librerías que traen manejadores web (p. ej. el
// consumidor de Vercel Queues) se sirven con este adaptador: lee el cuerpo
// crudo con tope, arma el `Request` y escribe el `Response` tal cual.
// ---------------------------------------------------------------------------

export type WebHandler = (request: Request) => Promise<Response>;
export type NodeHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

/** Tope del cuerpo: lo que llega por aquí son avisos de pocos bytes. */
export const MAX_WEB_BODY_BYTES = 256 * 1024;

/** Cabeceras propias de la conexión: no pasan al `Request`. */
const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-connection", "te", "trailer", "host", "content-length"]);

class BodyTooLarge extends Error {}

async function readBody(request: IncomingMessage, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new BodyTooLarge();
    chunks.push(buffer);
  }
  if (size === 0) return null;
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}

function toWebRequest(request: IncomingMessage, body: Uint8Array<ArrayBuffer> | null): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `https://${request.headers.host ?? "localhost"}`);
  return new Request(url, { method, headers, body: method === "GET" || method === "HEAD" ? null : body });
}

async function writeWebResponse(source: Response, response: ServerResponse): Promise<void> {
  response.statusCode = source.status;
  source.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(Buffer.from(await source.arrayBuffer()));
}

export function webHandlerOnNode(handler: WebHandler, maxBodyBytes: number = MAX_WEB_BODY_BYTES): NodeHandler {
  return async (request, response) => {
    let body: Uint8Array<ArrayBuffer> | null;
    try {
      body = await readBody(request, maxBodyBytes);
    } catch (error) {
      response.statusCode = error instanceof BodyTooLarge ? 413 : 400;
      response.end();
      return;
    }
    await writeWebResponse(await handler(toWebRequest(request, body)), response);
  };
}
