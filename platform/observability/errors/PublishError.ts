import { DomainError } from "./DomainError";

export class PublishError extends DomainError {
  public readonly code = "PUBLISH_ERROR";

  public constructor(message: string) {
    super(message, 409);
  }
}
