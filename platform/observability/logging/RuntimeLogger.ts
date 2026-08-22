import type { Logger } from "./Logger";

// Responsabilidad única: loguear eventos del motor de ejecución de flows.
// flowId y versionId son campos de primer nivel para facilitar el filtrado.
export class RuntimeLogger {
  public constructor(private readonly logger: Logger) {}

  public logFlowStarted(tenantId: string, flowId: string, versionId: string, conversationKey: string): void {
    this.logger.info("runtime.flow.started", { tenantId, flowId, versionId, conversationKey });
  }

  public logNodeExecuted(tenantId: string, flowId: string, nodeId: string, nodeType: string): void {
    this.logger.debug("runtime.node.executed", { tenantId, flowId, nodeId, nodeType });
  }

  public logFlowCompleted(tenantId: string, flowId: string, durationMs: number): void {
    this.logger.info("runtime.flow.completed", { tenantId, flowId, durationMs });
  }

  public logFlowError(tenantId: string, flowId: string, error: Error): void {
    this.logger.error("runtime.flow.error", {
      tenantId,
      flowId,
      errorCode: "code" in error ? String(error.code) : undefined,
      errorMessage: error.message
    });
  }
}
