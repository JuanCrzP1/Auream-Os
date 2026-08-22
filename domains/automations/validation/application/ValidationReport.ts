/**
 * Tipos del sistema de validación de grafos.
 *
 * Extraído de GraphValidator.ts para evitar dependencias circulares
 * entre el validador y las reglas individuales.
 */

export interface ValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

export interface ValidationReport {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<ValidationIssue>;
  readonly warnings: ReadonlyArray<ValidationIssue>;
}
