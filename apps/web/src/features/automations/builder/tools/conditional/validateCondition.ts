import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";
import { categoryHasField, operatorNeedsValue, readConditionConfig } from "./conditionConfig";

export const NO_RULES_MESSAGE = "Añade al menos una regla.";
export const MISSING_FIELD_MESSAGE = "Indica qué campo evalúa cada regla.";
export const MISSING_VALUE_MESSAGE = "Completa el valor de cada regla.";
export const INVALID_TIME_MESSAGE = "Escribe la hora con el formato HH:MM.";
export const INVALID_DATE_MESSAGE = "Elige una fecha válida.";

export function validateCondition(_content: ToolData, config: ToolData): ValidationResult {
  const { rules } = readConditionConfig(config);
  if (rules.length === 0) return invalid(NO_RULES_MESSAGE);

  for (const rule of rules) {
    if (categoryHasField(rule.category) && rule.field.trim().length === 0) return invalid(MISSING_FIELD_MESSAGE);
    if (!operatorNeedsValue(rule)) continue;
    if (rule.value.trim().length === 0) return invalid(MISSING_VALUE_MESSAGE);
    if (rule.category === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.value)) return invalid(INVALID_TIME_MESSAGE);
    if (rule.category === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(rule.value)) return invalid(INVALID_DATE_MESSAGE);
  }

  return VALID;
}
