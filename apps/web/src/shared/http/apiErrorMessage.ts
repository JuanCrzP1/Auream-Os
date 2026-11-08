import { RequestError } from "./RequestError";

/**
 * Mensaje legible de un error de la API (409, 422, 429…) para mostrarlo al
 * usuario; si no hay uno apto (5xx, red, cuerpo no JSON), el genérico dado.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof RequestError) {
    try {
      const parsed = JSON.parse(error.body) as { message?: unknown };
      if (typeof parsed.message === "string" && error.status < 500) return parsed.message;
    } catch {
      /* cuerpo no JSON */
    }
  }
  return fallback;
}
