import { DomainError } from "../../observability/errors/DomainError";

export class AccessError extends DomainError {
  public readonly code = "ACCESS_DENIED";

  public constructor(reason: string) {
    super(reason, 403);
    this.name = "AccessError";
  }
}
