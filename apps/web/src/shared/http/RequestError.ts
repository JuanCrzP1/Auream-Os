/**
 * RequestError — error tipado para respuestas HTTP no-2xx.
 *
 * Permite distinguir errores de red (TypeError) de errores de API
 * sin depender de convenciones de mensajes.
 */
export class RequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`HTTP ${status}: ${body}`);
    this.name = "RequestError";
  }
}
