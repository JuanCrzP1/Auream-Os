// Base abstracta para todos los errores de dominio.
// Incluye statusCode para que la capa HTTP los propague correctamente.
// Todos los errores de dominio deben extender esta clase.
export abstract class DomainError extends Error {
  public abstract readonly code: string;
  public readonly statusCode: number;

  public constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}
