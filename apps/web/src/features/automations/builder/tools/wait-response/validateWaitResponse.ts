import {
  isWaitResponseAmount,
  isWaitResponseTimeUnit,
  resolveContextKey
} from "@contracts/WaitResponseConfig";
import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";

export const CONTRADICTORY_WAIT_MESSAGE =
  "Desactiva «Esperar sin límite» para poder fijar un tiempo máximo.";

export const MISSING_TIMEOUT_MESSAGE = "Indica cuánto tiempo se espera como máximo.";

export const INVALID_TIMEOUT_MESSAGE = "El tiempo máximo debe ser un número entero mayor que cero.";

export const INVALID_UNIT_MESSAGE = "Elige minutos u horas para el tiempo máximo.";

export const INVALID_TARGET_MESSAGE =
  "El campo donde guardar la respuesta solo admite letras, números, guion y guion bajo.";

/** Nombre resoluble contra `session.context` por `EdgeEvaluator` y las plantillas. */
const CONTEXT_FIELD = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * ¿Puede guardarse esta espera? Mira el config CRUDO: el lector descarta justo
 * lo que hay que señalar.
 *
 * No se valida el mensaje previo (opcional por diseño), la reacción (ausente
 * es válido) ni el fallback del grafo (pregunta de publicación, no del nodo).
 */
export function validateWaitResponse(_content: ToolData, config: ToolData): ValidationResult {
  const indefinite = config.waitIndefinitely !== false;
  const rawTimeout = config.timeout;
  const timeout =
    typeof rawTimeout === "object" && rawTimeout !== null
      ? (rawTimeout as Record<string, unknown>)
      : null;

  if (indefinite && timeout !== null) return invalid(CONTRADICTORY_WAIT_MESSAGE);

  if (!indefinite) {
    if (timeout === null) return invalid(MISSING_TIMEOUT_MESSAGE);
    if (!isWaitResponseAmount(timeout.amount)) return invalid(INVALID_TIMEOUT_MESSAGE);
    if (!isWaitResponseTimeUnit(timeout.unit)) return invalid(INVALID_UNIT_MESSAGE);
  }

  const target = resolveContextKey(config.targetKey);
  if (target !== null && !CONTEXT_FIELD.test(target)) return invalid(INVALID_TARGET_MESSAGE);

  return VALID;
}
