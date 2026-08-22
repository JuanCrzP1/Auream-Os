import type { Logger } from "./Logger";
import type { RequestContext } from "../../identity/contracts/RequestContext";

// Responsabilidad única: loguear eventos del ciclo de vida HTTP.
// Depende de Logger (inyectado), no de ningún framework HTTP concreto.
export class RequestLogger {
  public constructor(private readonly logger: Logger) {}

  public logReceived(context: RequestContext, method: string, pathname: string): void {
    this.logger.info("http.request.received", {
      requestId: context.requestId,
      tenantId: context.tenantId,
      actorId: context.actorId,
      authMethod: context.authMethod,
      method,
      pathname
    });
  }

  public logCompleted(context: RequestContext, statusCode: number, durationMs: number): void {
    this.logger.info("http.request.completed", {
      requestId: context.requestId,
      tenantId: context.tenantId,
      statusCode,
      durationMs
    });
  }

  public logUnauthenticated(method: string, pathname: string, requestId: string): void {
    this.logger.warn("http.request.unauthenticated", { method, pathname, requestId });
  }
}
