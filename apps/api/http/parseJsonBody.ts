import type { IncomingMessage } from "node:http";
import { DomainError } from "../../../platform/observability/errors/DomainError";

/** Cuerpo máximo aceptado. Un flujo grande ocupa decenas de KB; esto deja margen sin abrir la puerta a abusos. */
export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

/** 400: el cuerpo no es JSON. */
export class MalformedBodyError extends DomainError {
  public readonly code = "MALFORMED_BODY";
  public constructor() {
    super("El cuerpo de la petición no es JSON válido.", 400);
  }
}

/** 413: el cuerpo supera `MAX_JSON_BODY_BYTES`. */
export class BodyTooLargeError extends DomainError {
  public readonly code = "BODY_TOO_LARGE";
  public constructor() {
    super("El cuerpo de la petición es demasiado grande.", 413);
  }
}

/**
 * Lee y parsea el cuerpo JSON de una petición, con tope de tamaño. Corta la
 * lectura en cuanto lo supera (no carga el resto en memoria). Sin cuerpo
 * devuelve `{}`. La FORMA del contenido la valida cada handler.
 */
export async function parseJsonBody<T>(request: IncomingMessage, maxBytes: number = MAX_JSON_BODY_BYTES): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new BodyTooLargeError();
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as T;
  } catch {
    throw new MalformedBodyError();
  }
}
