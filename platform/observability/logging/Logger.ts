// Interfaz central de logging.
// Todo componente que necesite loguear recibe un Logger por inyección.
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;

  // Crea un logger hijo con contexto base adicional (sin mutar el padre).
  withContext(context: Record<string, unknown>): Logger;
}
