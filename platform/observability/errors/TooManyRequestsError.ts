import { DomainError } from "./DomainError";

/** Se superó el límite de uso de una operación; reintentar más tarde. */
export class TooManyRequestsError extends DomainError {
  public readonly code = "TOO_MANY_REQUESTS";

  public constructor(
    message: string,
    public readonly retryAfterMs: number
  ) {
    super(message, 429);
  }
}
