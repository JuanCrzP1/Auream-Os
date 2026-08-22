import { DomainError } from "./DomainError";

export class RuntimeError extends DomainError {
  public readonly code = "RUNTIME_ERROR";

  public constructor(message: string) {
    super(message, 500);
  }
}
