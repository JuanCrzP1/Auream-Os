import type { ServerResponse } from "node:http";

/**
 * Serializa una respuesta JSON.
 *
 * No aplica CORS: esa responsabilidad es exclusiva de `applyCorsHeaders`,
 * que decide por lista blanca antes de entrar al routing.
 */
export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}
