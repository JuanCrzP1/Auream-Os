import type { IncomingMessage, ServerResponse } from "node:http";

// Utilidades HTTP mínimas del simulador (sin dependencias): leer JSON,
// responder JSON y una tabla de rutas por método y ruta exacta o con `:param`.

export type Json = Record<string, unknown>;

export interface RouteContext {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  body(): Promise<Json>;
}

export type Handler = (context: RouteContext) => Promise<void> | void;

const MAX_BODY_BYTES = 25 * 1024 * 1024;

export async function readJson(request: IncomingMessage): Promise<Json> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Cuerpo demasiado grande.");
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Json) : {};
}

export function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

/** Solo los dígitos de un número o de un jid («57300…@s.whatsapp.net» → «57300…»). */
export const digitsOf = (value: unknown): string => text(value).split("@")[0]!.split(":")[0]!.replace(/\D/g, "");

/** Tabla de rutas: `METHOD /ruta/:param`. */
export class Router {
  private readonly routes: Array<{ method: string; parts: string[]; handler: Handler }> = [];

  public on(method: string, path: string, handler: Handler): this {
    this.routes.push({ method, parts: path.split("/").filter(Boolean), handler });
    return this;
  }

  /** Atiende la petición si alguna ruta coincide; si no, devuelve `false`. */
  public async handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
    const parts = url.pathname.split("/").filter(Boolean);
    for (const route of this.routes) {
      if (route.method !== request.method || route.parts.length !== parts.length) continue;
      const params: Record<string, string> = {};
      const matches = route.parts.every((part, index) => {
        if (part.startsWith(":")) {
          params[part.slice(1)] = decodeURIComponent(parts[index]!);
          return true;
        }
        return part === parts[index];
      });
      if (!matches) continue;
      let cached: Json | null = null;
      await route.handler({ request, response, url, params, body: async () => (cached ??= await readJson(request)) });
      return true;
    }
    return false;
  }
}
