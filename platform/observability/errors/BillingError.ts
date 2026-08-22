import { DomainError } from "./DomainError";

export class BillingError extends DomainError {
  public readonly code = "BILLING_ERROR";

  public constructor(message: string) {
    super(message, 402);
  }
}
