import type { Logger } from "./Logger";
import type { RequestContext } from "../../identity/contracts/RequestContext";

// Responsabilidad única: loguear decisiones de acceso.
// Facilita detección de intentos no autorizados y análisis de seguridad.
export class AccessLogger {
  public constructor(private readonly logger: Logger) {}

  public logDenied(context: RequestContext, scope: string, reason: string): void {
    this.logger.warn("access.denied", {
      requestId: context.requestId,
      tenantId: context.tenantId,
      actorId: context.actorId,
      scope,
      reason
    });
  }

  public logGranted(context: RequestContext, scope: string): void {
    this.logger.debug("access.granted", {
      requestId: context.requestId,
      tenantId: context.tenantId,
      actorId: context.actorId,
      scope
    });
  }
}
