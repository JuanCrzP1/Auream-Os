import type { Logger } from "./Logger";

// Responsabilidad única: loguear errores con contexto completo.
// Extrae automáticamente statusCode y code de errores tipados.
export class ErrorLogger {
  public constructor(private readonly logger: Logger) {}

  public log(
    error: Error,
    context: { requestId?: string; tenantId?: string; actorId?: string } = {}
  ): void {
    const statusCode = "statusCode" in error ? (error as { statusCode: number }).statusCode : 500;
    const code = "code" in error ? String((error as { code: unknown }).code) : "UNKNOWN_ERROR";

    const level = statusCode >= 500 ? "error" : "warn";

    this.logger[level]("unhandled.error", {
      ...context,
      errorName: error.name,
      errorCode: code,
      errorMessage: error.message,
      statusCode
    });
  }
}
