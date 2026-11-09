import { DomainError } from "./DomainError";

/**
 * Un servicio externo del que depende la operación (p. ej. el proveedor de
 * WhatsApp) falló o no respondió. 424 (Failed Dependency): no es un error
 * interno, así que el mensaje —que nunca lleva credenciales— llega al usuario.
 */
export class UpstreamError extends DomainError {
  public readonly code = "UPSTREAM_FAILED";

  public constructor(message: string) {
    super(message, 424);
  }
}
