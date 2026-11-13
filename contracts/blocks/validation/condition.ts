import { VALID, invalid, type BlockData, type BlockCheck } from "../BlockRules";
import { categoryHasField, operatorNeedsValue, readConditionConfig, ruleValues, type ConditionRule } from "../../ConditionConfig";
import { parseFieldNumber } from "../../FieldValues";

export const NO_RULES_MESSAGE = "Añade al menos una regla.";
export const MISSING_FIELD_MESSAGE = "Indica qué campo evalúa cada regla.";
export const MISSING_VALUE_MESSAGE = "Completa el valor de cada regla.";
export const INVALID_TIME_MESSAGE = "Escribe la hora con el formato HH:MM.";
export const INVALID_DATE_MESSAGE = "Elige una fecha válida.";
export const MISSING_OPTION_MESSAGE = "Elige al menos una opción en cada regla de lista.";
export const INVALID_RANGE_MESSAGE = "Escribe los dos números de «está entre».";
export const INVALID_DAYS_MESSAGE = "Escribe cuántos días con un número entero.";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Lo que exige el valor de una regla con tipo de un campo del cliente; `null` si está bien. */
function typedFieldProblem(rule: ConditionRule): string | null {
  switch (rule.operator) {
    case "is_one_of":
    case "is_none_of":
      return ruleValues(rule).length === 0 ? MISSING_OPTION_MESSAGE : null;
    case "between": {
      const values = ruleValues(rule);
      return values.length === 2 && values.every((value) => parseFieldNumber(value) !== undefined) ? null : INVALID_RANGE_MESSAGE;
    }
    case "within_next_days":
    case "at_least_days_ago":
      return /^\d{1,4}$/.test(rule.value.trim()) ? null : INVALID_DAYS_MESSAGE;
    case "before_date":
    case "after_date":
      return ISO_DAY.test(rule.value) ? null : INVALID_DATE_MESSAGE;
    default:
      return null;
  }
}

export function validateCondition(_content: BlockData, config: BlockData): BlockCheck {
  const { rules } = readConditionConfig(config);
  if (rules.length === 0) return invalid(NO_RULES_MESSAGE);

  for (const rule of rules) {
    if (categoryHasField(rule.category) && rule.field.trim().length === 0) return invalid(MISSING_FIELD_MESSAGE);
    if (!operatorNeedsValue(rule)) continue;
    if (rule.category === "customField") {
      const problem = typedFieldProblem(rule);
      if (problem) return invalid(problem);
    }
    if (rule.value.trim().length === 0) return invalid(MISSING_VALUE_MESSAGE);
    if (rule.category === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.value)) return invalid(INVALID_TIME_MESSAGE);
    if (rule.category === "date" && !ISO_DAY.test(rule.value)) return invalid(INVALID_DATE_MESSAGE);
  }

  return VALID;
}
