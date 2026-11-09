import type { IncomingMessage } from "node:http";
import { BodyTooLargeError, MAX_JSON_BODY_BYTES, parseJsonBody } from "./parseJsonBody";

/**
 * Lee el cuerpo como formulario (`application/x-www-form-urlencoded`) o JSON,
 * según su tipo, con tope de tamaño. Los formularios vuelven como objeto de
 * textos. Lo usan los webhooks de entrada y el endpoint de tokens OAuth.
 */
export async function parseFormOrJsonBody(request: IncomingMessage, maxBytes: number = MAX_JSON_BODY_BYTES): Promise<unknown> {
  const type = String(request.headers["content-type"] ?? "").toLowerCase();
  if (!type.includes("application/x-www-form-urlencoded")) return parseJsonBody<unknown>(request, maxBytes);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new BodyTooLargeError();
    chunks.push(buffer);
  }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString("utf-8")));
}
