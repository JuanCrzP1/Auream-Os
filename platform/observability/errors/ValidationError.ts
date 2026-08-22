import { DomainError } from "./DomainError";

export class ValidationError extends DomainError {
  public readonly code = "VALIDATION_ERROR";

  public constructor(message: string) {
    super(message, 422);
  }
}
