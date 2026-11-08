import { DomainError } from "./DomainError";

/**
 * El recurso no existe EN ESTE TENANT. Desde fuera, uno ajeno y uno
 * inexistente son lo mismo: el mensaje no debe distinguirlos.
 */
export class NotFoundError extends DomainError {
  public readonly code = "NOT_FOUND";

  public constructor(message: string) {
    super(message, 404);
  }
}
