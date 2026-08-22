import type { Logger } from "./Logger";

type LogLevel = "info" | "warn" | "error" | "debug";

// Implementación de Logger que escribe NDJSON a stdout.
// Compatible con Docker, k8s log aggregators y cualquier sistema que
// consuma structured logs por stdout (Datadog, CloudWatch, etc.).
export class StructuredLogger implements Logger {
  public constructor(private readonly baseContext: Record<string, unknown> = {}) {}

  public info(message: string, context: Record<string, unknown> = {}): void {
    this.write("info", message, context);
  }

  public warn(message: string, context: Record<string, unknown> = {}): void {
    this.write("warn", message, context);
  }

  public error(message: string, context: Record<string, unknown> = {}): void {
    this.write("error", message, context);
  }

  public debug(message: string, context: Record<string, unknown> = {}): void {
    this.write("debug", message, context);
  }

  public withContext(context: Record<string, unknown>): StructuredLogger {
    return new StructuredLogger({ ...this.baseContext, ...context });
  }

  private write(level: LogLevel, message: string, context: Record<string, unknown>): void {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.baseContext,
      ...context
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  }
}
