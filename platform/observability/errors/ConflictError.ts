import { DomainError } from "./DomainError";

/**
 * La operación se basó en un estado que ya no es el actual (por ejemplo, se
 * guardó un borrador editado sobre una revisión que otra pestaña ya cambió).
 * El cliente debe recargar antes de volver a intentarlo.
 */
export class ConflictError extends DomainError {
  public readonly code = "CONFLICT";

  public constructor(message: string) {
    super(message, 409);
  }
}
